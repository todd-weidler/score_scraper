"use strict";
const admin = require("firebase-admin");
admin.initializeApp()
const cron = require("node-cron");
const db = admin.firestore();

console.log("Waiting only minute for debugging"); 

async function getUpcomingGames() { // returns an array that contains each upcoming game as an object.
	
	const puppeteer = require("puppeteer");

	var count = 1;

	let Upgames = [];

    const url = "https://www.espn.com/nba/scoreboard/_/date/"
	const currentTime = new Date();
	const dd = String(currentTime.getDate()).padStart(2,'0');
	const mm = String(currentTime.getMonth() + 1).padStart(2,'0');
	const yyyy = currentTime.getFullYear();


	await (async () => {

		const browser = await puppeteer.launch({ headless: false });
		const page = await browser.newPage();

		await page.goto(url + yyyy + mm + dd);
  
  // For debugging
		page.on('console', msg => {
		for (let i = 0; i < msg.args().length; ++i)
			console.log(`${i}: ${msg.args()[i]}`);
		
		}
	);
     
  
    Upgames = await page.evaluate(async () => {
    

    let upcominggames = [];
	
    const target = document.querySelector("#events");

	
	var list = target.childNodes;
	
	list.forEach( function( x ){
      
          if (x.nodeName === "ARTICLE" && x.className == 'scoreboard basketball pregame js-show'){
			  //check if game is upcoming.

			  var teams = x.querySelector("#teams");
			  var away = teams.querySelector(".away");
			  var home = teams.querySelector(".home");
			  var awayAbbrev = away.querySelector(".sb-team-abbrev").textContent;
			  var homeAbbrev = home.querySelector(".sb-team-abbrev").textContent;
			  var awayName = awayAbbrev + " " + away.querySelector(".sb-team-short").textContent
			  var homeName = homeAbbrev + " " + home.querySelector(".sb-team-short").textContent;
			  var startDate = x.querySelector('.date-time').getAttribute('data-date');
			  var bettingLine = x.querySelector('.line').textContent.split('-');
			  var underDog = "";
			  var overDog = "";
			  var isHomeFav = false;
			  
			  if (bettingLine[0] === (awayAbbrev + " ")){
				   underDog = awayAbbrev;
				   overDog = homeAbbrev;
				   isHomeFav = true;
			  }
			  else{
				   underDog = homeAbbrev;
				   overDog = awayAbbrev;
				  
			  }
			  var underDogLine = underDog + " -" + bettingLine[1];
			  var overDogLine = overDog + " " + bettingLine[1];
			  
		 	  var OverUnder = x.querySelector('.stat.stat--full-width').lastElementChild.textContent.split(' ')[1];
			  
			  
			  var id = awayName + "_" + homeName;
			  
			 // upcominggames.push({homeTeam: homeName, awayTeam: awayName, gameStartDateTime: startDate,.....etc});
              upcominggames.push({awayTeam: awayName,gameId: "???", gameStartDateTime: startDate, gameStatus: "upcoming", homeTeam: homeName, isAvaiableForContestInvitation: "??", isHomeTeamFavorite: isHomeFav, overBetStr: "o " + OverUnder  , spreadFavoriteBetStr: overDogLine , spreadUnderdogBetStr: underDogLine,underBetStr: "u " + OverUnder});
		  
		  }

	})
     
	 return [].concat(upcominggames);
  });
  
  await browser.close();
  

})();
 return Upgames;
}


function customUTCDateStr(DObj){
		 const dd = String(DObj.getDate()).padStart(2,'0');
         const mm = String(DObj.getMonth() + 1).padStart(2,'0');
         const yyyy = DObj.getFullYear();
		 const HH = String(DObj.getHours()).padStart(2,'0');
		 const MM = String(DObj.getMinutes()).padStart(2,'0');
		 return yyyy + "-" + mm + "-" + dd + "-" + HH + ":" + MM;
}

//// To be called in upcoming games chron.
//// Need to edit schedule time. Currenly set to once per minute for debugging purposes.



cron.schedule("* * * * *", async function (){
	
  	let arrayM =  await getUpcomingGames();
    // Add upcoming games to firebase? 
	let draftExpirationDateTimes = new Set();
	let invitationExpirationDateTimes = new Set();
	let draftExpirationDocIds = new Set();
	let invitationExpirationDocIds = new Set();
	
	arrayM.forEach( function(x) {
		console.log("%O",x);
		draftExpirationDateTimes.add(new Date(x.gameStartDateTime));
	})
    
	draftExpirationDateTimes.forEach(function (x) {
		  draftExpirationDocIds.add(customUTCDateStr(x));
	      invitationExpirationDateTimes.add(new Date(x.valueOf() - (30 * 60000)));
	})
	invitationExpirationDateTimes.forEach(function (x) {
		  invitationExpirationDocIds.add(customUTCDateStr(x));

	})
	
	
	// "Unable to detect a Project Id in the current environment. (error thrown by commented out portion) Everything else works."
	
    /* 
	const batch = db.batch();
	const DRef = db.collection('draft_expirations_subscriptions');
	const invRef = db.collection('invitation_expiration_subscriptions');
	
	draftExpirationDocIds.forEach(function (x) {
		batch.set(DRef.doc(x),{});
	})
	
	invitationExpirationDocIds.forEach(function (x) {
		batch.set(invRef.doc(x),{});
	})
	
	await batch.commit()
	//batchedwrite
	*/

})





