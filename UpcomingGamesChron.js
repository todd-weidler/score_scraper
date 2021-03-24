"use strict";

const { firestore } = require("firebase-admin");
const admin = require("firebase-admin");
const cron = require("node-cron");
const puppeteer = require("puppeteer");

const serviceAccount = require('./ServiceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

console.log("Waiting only a minute for debugging"); 

async function scrapeUpcomingGames() { // returns an array that contains each upcoming game as an object.
	
  const url = "https://www.espn.com/nba/scoreboard/_/date/"
	const currentTime = new Date();
	const dd = String(currentTime.getDate()).padStart(2,'0');
	const mm = String(currentTime.getMonth() + 1).padStart(2,'0');
	const yyyy = currentTime.getFullYear();


		const browser = await puppeteer.launch({ headless: true });
		const page = await browser.newPage();

		await page.goto(url + yyyy + mm + dd);
  
  	// For debugging
		page.on('console', msg => {
			for (let i = 0; i < msg.args().length; ++i)
				console.log(`${i}: ${msg.args()[i]}`);
			}
		);
     
  
    const upcomingGames = await page.evaluate(() => {
    

    let upcomingGames = [];
	
		const gameContainers = document.querySelectorAll("#events > article.scoreboard.basketball.pregame.js-show");
	
	
		for (let i = 0; i < gameContainers.length; i++) {
      
      let gameContainer = gameContainers[i];

      const teams = gameContainer.querySelector("#teams");
      const awayTeamContainer = teams.querySelector(".away");
      const homeTeamContainer = teams.querySelector(".home");
      const awayAbbrev = awayTeamContainer.querySelector(".sb-team-abbrev").textContent.trim();
      const homeAbbrev = homeTeamContainer.querySelector(".sb-team-abbrev").textContent.trim();
      const awayFullName = awayAbbrev + " " + awayTeamContainer.querySelector(".sb-team-short").textContent
      const homeFullName = homeAbbrev + " " + homeTeamContainer.querySelector(".sb-team-short").textContent;
      const startDateTimeUTCStr = gameContainer.querySelector('.date-time').getAttribute('data-date');

      const betLinesDivs = gameContainer.querySelectorAll('section.sb-detail > div.stat > div');

      if(betLinesDivs.length != 2){
        console.log("Error in scraper: There was not exactly two divs found when querying for the divs that store the betting lines data. Instead it found "+betLinesDivs.length);
        return [];
      }
			  

      const [betType1, betStr1] = betLinesDivs[0].textContent.split(":").map((x) => x.trim());
      const [betType2, betStr2] = betLinesDivs[1].textContent.split(":").map((x) => x.trim());

      let wasSpreadFound = false;
      let wasOverUnderFound = false;

      let spreadBetStr = "";
      let ouBetStr = "";


      if(betType1.toLowerCase() == "line"){
        wasSpreadFound = true;
        spreadBetStr = betStr1;
      }
      else if(betType1.toLowerCase() == "o/u"){
        wasOverUnderFound = true;
        ouBetStr = betStr1;
      }

      if(betType2.toLowerCase() == "line"){
        wasSpreadFound = true;
        spreadBetStr = betStr2;
      }
      else if(betType2.toLowerCase() == "o/u"){
        wasOverUnderFound = true;
        ouBetStr = betStr2;
      }


      // if at least one of them werent found then we have a major error
      if(!wasSpreadFound || !wasOverUnderFound){
        logError("Error in scraper: The spread and o/u bets werent found");
        return [];
      }


      let overBetStr = "o " + ouBetStr;
      let underBetStr = "u " + ouBetStr;


      let isHomeTeamFavorite = false;

      const spreadFavTeamAbrev = spreadBetStr.split("-")[0].trim();

      let spreadFavoriteBetStr = "";
      let spreadUnderdogBetStr = "";

      // finds out if the home team is the favorite for the spread bet
      if(spreadFavTeamAbrev == homeAbbrev){

        isHomeTeamFavorite = true;

        let spreadAmtStr = spreadBetStr.split("-")[1].trim();
        let spreadAmtFloat = parseFloat(spreadAmtStr);
        let spreadAmtInt = Math.floor(spreadAmtFloat)

        // if the spread amount isnt a whole number
        if(spreadAmtFloat > spreadAmtInt){
          spreadUnderdogBetStr = awayAbbrev + " +" + spreadAmtFloat.toFixed(1);
          spreadFavoriteBetStr = homeAbbrev + " -" + spreadAmtFloat.toFixed(1);
        }
        else{
          spreadUnderdogBetStr = awayAbbrev + " +" + spreadAmtInt;
          spreadFavoriteBetStr = homeAbbrev + " -" + spreadAmtInt;
        }
      }
      else if(spreadFavTeamAbrev == awayAbbrev){

        isHomeTeamFavorite = false;

        let spreadAmtStr = spreadBetStr.split("-")[1].trim();
        let spreadAmtFloat = parseFloat(spreadAmtStr);
        let spreadAmtInt = Math.floor(spreadAmtFloat)

        // if the spread amount isnt a whole number
        if(spreadAmtFloat > spreadAmtInt){
          spreadUnderdogBetStr = homeAbbrev + " +" + spreadAmtFloat.toFixed(1);
          spreadFavoriteBetStr = awayAbbrev + " -" + spreadAmtFloat.toFixed(1);
        }
        else{
          spreadUnderdogBetStr = homeAbbrev + " +" + spreadAmtInt;
          spreadFavoriteBetStr = awayAbbrev + " -" + spreadAmtInt;
        }
      }
      else{
        console.log("Error in scraper: The favorite for the spread bet does not equal either team: Spread team abbrev: " + spreadFavTeamAbrev);
        return [];
      }

      upcomingGames.push({
              "homeTeam": homeFullName, 
              "awayTeam": awayFullName, 
              "isHomeTeamFavorite": isHomeTeamFavorite, 
              "spreadFavoriteBetStr": spreadFavoriteBetStr, 
              "spreadUnderdogBetStr": spreadUnderdogBetStr,
              "overBetStr": overBetStr,
              "underBetStr": underBetStr,
              "gameStartUTCStr": startDateTimeUTCStr
            });
    
			
		  }
			return upcomingGames;
  });
  
  await browser.close();

  return upcomingGames;

}


function customUTCDateStr(date){
	return date.toISOString().replace(/T/, '-').replace(/\..+/, '') .slice(0, -3);
}

//// To be called in upcoming games chron.
//// Need to edit schedule time. Currenly set to once per minute for debugging purposes.

	
	
async function writeDataToFirestore(games, draftExpirationDocIds, invitationExpirationDocIds){	
    
	const batch = db.batch();
	const draftExpSubsRef = db.collection("draft_expiration_subscriptions");
	const invitationExpSubsRef = db.collection("invitation_expiration_subscriptions");
	const gamesRef = db.collection("games");
	
	// creates all the documents for the draft expiration time slots
	draftExpirationDocIds.forEach((docId) => {
		let docRef = draftExpSubsRef.doc(docId);
		batch.set(docRef, {
			"draftIds": []
		});
	});
	
	// creates all the documents for the invitation expiration time slots
	invitationExpirationDocIds.forEach((docId) => {
		let docRef = invitationExpSubsRef.doc(docId);
		batch.set(docRef, {
			"invitationIds": []
		});
	});
	

	// adds all the upcoming games to the games collection
	games.forEach((game) => {

		let newGameDocRef = gamesRef.doc();
		let newDocId = newGameDocRef.id;

		batch.set(newGameDocRef, {
			"gameId": newDocId,
			"homeTeam": game.homeTeam,
			"awayTeam": game.awayTeam,
			"gameStatus": "upcoming",
			"isAvailableForContestInvitation": true,
			"gameStartDateTime": firestore.Timestamp.fromDate(new Date(game.gameStartUTCStr)),
			"isHomeTeamFavorite": game.isHomeTeamFavorite,
			"spreadFavoriteBetStr": game.spreadFavoriteBetStr,
			"spreadUnderdogBetStr": game.spreadUnderdogBetStr,
			"overBetStr": game.overBetStr,
			"underBetStr": game.underBetStr,
		});
	});

	await batch.commit();

	console.log("finished writing to firestore");
}



function startCron(){

  cron.schedule("0 1 * * *", async function (){

    const upcomingGames = await scrapeUpcomingGames();

		// prints out the upcoming games that were found for debugging reasons
    upcomingGames.forEach((game) => console.log(game));
  
		// creates a unique set of game start utc date strings
		const expirationTimes = Array.from(new Set(upcomingGames.map((game) => game.gameStartUTCStr)));  

			// creates the draft expirations doc ids
		const draftExpirationDocIds = expirationTimes.map((dtStr) => customUTCDateStr(new Date(dtStr)));

		// creates the invitation expirations doc ids
		const invitationExpirationDocIds = expirationTimes.map((dtStr) => {
			let date = new Date(dtStr)
			date.setUTCMinutes(date.getUTCMinutes() - 30);
			return customUTCDateStr(date);
		});

		
		console.log("Draft Expiration doc ids:");
		console.log(draftExpirationDocIds);
		console.log("Invitation Expiration doc ids:");
		console.log(invitationExpirationDocIds);


		// commented out so we don't write to db when testing
		// await writeDataToFirestore(upcomingGames, draftExpirationDocIds, invitationExpirationDocIds);

  });
}



startCron();


