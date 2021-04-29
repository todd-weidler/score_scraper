const { firestore } = require('firebase-admin');
const puppeteer = require('puppeteer');
const { db } = require('./db');
const getInitialGameStates = require("./getInitialGameStates");
const getNumMillisecondsUntilNextThreeAM = require("./utils/getNumMillisecondsUntilNextThreeAM");

const pm2 = require('pm2');

// const inspector = require('event-loop-inspector')();

// require('dotenv').config();

// const sendEmail = require("./utils/sendEmail");


async function start(){

  let browser;

  let cachedGameData;
  let scrapedGameData = [];

  let game_updates = [];
  let just_started_games = [];
  let just_completed_games = [];

  let games;

  // const scraperJobDocRef = db.collection("scraper_jobs").doc("current");

  startScraper();

  // const dbListenerHandle = scraperJobDocRef.onSnapshot(async (docSnapshot) => {

  //   if(!docSnapshot.exists){
  //     console.log(`Error: the document "current" was not found in the "scraper_jobs" collection`);
  //     return;
  //   }

  //   console.log("Document read from scraper_jobs/current");

  //   const {jobType} = docSnapshot.data();

  //   if(jobType == null){
  //     console.log("Error: the jobType field is null");
  //     return;
  //   }

  //   console.log("Scraper job was updated in database");

  //   switch(jobType){

  //     case "init":

  //       console.log("Scraper script has been initialized...will do nothing until it gets a command to start scraping");
  //       return;

  //     case "stop":

  //       console.log("Scraper jobType was stop...");

  //       if(browser != null){
          
  //         let emailMessage = "";
  
  //         await browser.close();
  
  //         if(browser.isConnected()){
  //           emailMessage = "Error somewhere: the browser is still connected";
  //         }
  //         else{
  //           emailMessage = "Browser was successfully closed.";
  //         }
  
  //         emailMessage += " Initiated by a stop command.";

  //         console.log(emailMessage);
  
  //         // send email saying that the scraper has closed the browser and no longer is looking for scores
  //         await sendEmail("Score Scraper Browser Close", emailMessage);
  //         console.log("Sent email about closing browser");
  //       }
  //       else{
  //         console.log("Browser obj was already null so stop command will do nothing");
  //       }
  
  //       return;

  //     case "start":

  //       console.log("Scraper jobType was start");

  //       if(browser == null){
  //         startScraper();
  //       }
  //       else{
  //         await browser.close();
  //         startScraper();
  //       }
  //       break;
  //     default:

  //       console.log(`Error: invalid jobType. The jobType was ${jobType}`);
  //       return;
  //   }
  // }, err => {
  //   console.log(`Encountered error: ${err}`);
  // });


  async function startScraper(){

    // const curDt = new Date();

    // let curUTCHour = curDt.getUTCHours();

    // if it between 3am and 11am ET
    // if(curUTCHour > 7 && curUTCHour < 15){
    //   console.log("Ignoring scraper job because scraper received it between 3am and 11am");
    //   return;
    // }

    // const numMilliseconds = getNumMillisecondsUntilNextThreeAM();

    await setUpScraper();

    // setTimeout(async () => {

    //   if(browser != null && browser.isConnected()){
    //     await browser.close();
    //   }

    // }, numMilliseconds);


    scrapeScores();

  }
  
  async function setUpScraper(){

    cachedGameData = new Map();

    games = await getInitialGameStates();
    initializeCache(cachedGameData, games);
  }


  async function scrapeScores(){

    // console.log("About to scrape");

    const url = "https://www.espn.com/nba/scoreboard/_/date/";
    const currentTime = new Date();
    const dd = String(currentTime.getDate()).padStart(2,'0');
    const mm = String(currentTime.getMonth() + 1).padStart(2,'0');
    const yyyy = currentTime.getFullYear();

    browser = await puppeteer.launch({headless: true, args:['--no-sandbox']});
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36');

    await page.goto(url + yyyy + mm + dd);
    await page.waitForSelector('#events');

    // For debugging
    // page.on('console', msg => {
    //     console.log(msg.text());
    //   }
    // );

    
    // await page.exposeFunction('console.log', (msg) => console.log(msg));
    await page.exposeFunction('scrapePage', scrapePage);
    await page.exposeFunction('findGameUpdates', findGameUpdates);
    await page.exposeFunction('updateCache', updateCache);
    await page.exposeFunction('applyUpdates', applyUpdates);
    await page.exposeFunction('closeBrowserIfAllGamesHaveCompleted', closeBrowserIfAllGamesHaveCompleted);
    await page.exposeFunction('performScrape', performScrape);
    
    await page.exposeFunction('notifyManagerOfCompletion', notifyManagerOfCompletion);
   // notifyManagerOfCompletion
    try{
      await page.evaluate(() => {

        // if(true){

        //   await scrapePage();
        //     // console.log("here");
        //     // findGameUpdates();
        //     // updateCache();
        //     // await applyUpdates();

        //     console.log("finished scraping")

        //   return;
        // }

       
          const target = document.querySelector("#events");

          const observer = new MutationObserver((mutations) => {
            //when a mutation has been detected
    
            // get the games from page

            // await scrapePage();
            // findGameUpdates();
            // updateCache();
            // // await applyUpdates();
            // await closeBrowserIfAllGamesHaveCompleted();

            performScrape();

          });
          
          observer.observe(target, {
            childList: true,
            characterData: true,
            subtree: true,
          });
      });

    }
    catch(err){}
   
  
    async function performScrape(){

      console.log("here");
      await scrapePage();
      findGameUpdates();
      updateCache();
      await applyUpdates();
      await closeBrowserIfAllGamesHaveCompleted();

      // console.log(inspector.dump());
    }
      
    async function scrapePage(){
    
      // all games
      let allGamesArray = [];
    
      // storing live games in array
      let inProgressGamesContainers = await page.$$('#events > article.scoreboard.basketball.live');
    
    
      for(let i = 0; i < inProgressGamesContainers.length; i++) {
        
        const gameContainer = inProgressGamesContainers[i];
    
        const teamAbbrevs = await gameContainer.$$eval('.sb-team-abbrev', (nodes) => nodes.map(el => el.innerText));

        const awayTeamAbbrev = teamAbbrevs[0].trim();
        const homeTeamAbbrev = teamAbbrevs[1].trim();
    
        const awayScoreStr = await gameContainer.$eval('tr.away > td.total', el => el.innerText.trim());
        const homeScoreStr = await gameContainer.$eval('tr.home > td.total', el => el.innerText.trim());
        const fullTimeLeftStr = await gameContainer.$eval('tr.sb-linescore > th.date-time', el => el.innerText.trim());
    
        const gameNameId = homeTeamAbbrev + "_" + awayTeamAbbrev;
        
        const awayScore = parseInt(awayScoreStr);
        const homeScore = parseInt(homeScoreStr);
    
        if(awayScore == null || awayScore == NaN){
          console.log("Error: issue parsing awayScoreStr");
          return;
        }
    
        if(homeScore == null || homeScore == NaN){
          console.log("Error: issue parsing homeScoreStr");
          return;
        }
    
        if(fullTimeLeftStr == null || fullTimeLeftStr == ""){
          console.log("Error: fullTimeLeftStr is empty or null");
          return;
        }
    
        let isOverTime = false;
        let numOverTime = 0;
        let currentQuarter = 0;
        let isHalftime = false;
        let isEndOfFirst = false;
        let isEndOfThird = false;
        let isEndOfFourth = false;
        let isEndOfOverTime = false;
        let minsLeftInQtr = 0;
        let secsLeftInQtr = 0;
    
        if(fullTimeLeftStr.includes("-")){
    
          const timeLeftStrComps = fullTimeLeftStr.split("-").map((x) => x.trim());
          const timeLeftAmtStr = timeLeftStrComps[0];
          const quarterStr = timeLeftStrComps[1].toLowerCase();
    

          // 
          if(timeLeftAmtStr.includes(".")){

            const secsStr = timeLeftAmtStr.trim();
            const secsLeft = parseFloat(secsStr);

            if(secsLeft == null || secsLeft == NaN){
              console.log("Error parsing secsStr");
              return;
            }

            secsLeftInQtr = secsLeft;
            minsLeftInQtr = 0;
          }
          else if(timeLeftAmtStr.includes(":")){

            const timeLeftAmtComps = timeLeftAmtStr.split(":").map((x) => x.trim());
    
            const minsLeft = parseInt(timeLeftAmtComps[0]) || 0;
            const secsLeft = parseFloat(timeLeftAmtComps[1]);
      
            if(secsLeft == null || secsLeft == NaN){
              console.log("Error parsing secsLeft");
              return;
            }
      
            minsLeftInQtr = minsLeft;
            secsLeftInQtr = secsLeft;

          }
          else{
            console.log("Error in parser for timeLeftAmtStr");
            return;
          }

          
    
          // if it is in overtime
          if(quarterStr.includes("ot")){
    
            const numOverTimeStr = quarterStr.slice(2);
    
            if(numOverTimeStr == null){
              console.log("error getting the number of overtimes the game is in");
              return;
            }
    
            if(numOverTimeStr == ""){
              numOverTime = 1;
            }
            else{
    
              const numOT = parseInt(numOverTimeStr);
    
              if(numOT== null || numOT == NaN){
                console.log("error parsing numOT");
                return;
              }
              numOverTime = numOT;
    
            }
      
            isOverTime = true;
          }
          else if(quarterStr.includes("1")){
            currentQuarter = 1;
          }
          else if(quarterStr.includes("2")){
            currentQuarter = 2;
          }
          else if(quarterStr.includes("3")){
            currentQuarter = 3;
          }
          else if(quarterStr.includes("4")){
            currentQuarter = 4;
          }
          else{
            console.log(`Error: the current quarter info is not valid. quarterStr is ${quarterStr}\n and the fullTimeLeftStr is ${fullTimeLeftStr}`);
            return;
          }
        }
        else{ // End of 1st, Halftime, End of 3rd, End of OT
    
          const displayStr = fullTimeLeftStr.toLowerCase();
    
          if(displayStr == null){
            return;
          }
    
          if(displayStr.includes("end")){
            // if it is the end of the 1st quarter
            if(displayStr.includes("1")){
              isEndOfFirst = true;
            }
            // if it is the end of the 3rd quarter
            else if(displayStr.includes("3")){
              isEndOfThird = true;
            }
            else if(displayStr.includes("4")){
              isEndOfFourth = true;
            }
            else{
              console.log("Error: the displayStr does not contain 1 or 3 or 4");
              return;
            }
          }
          // if it is halftime
          else if(displayStr.includes("halftime")){
            isHalftime = true;
          }
          else if(displayStr.includes("ot")){
            isEndOfOverTime = true;
          }
          else{
            console.log("Error: the displayStr does not contain valid text");
            return;
          }
        }
        
        
        allGamesArray.push({
          "gameStatus": "inprogress",
          "lookupId": gameNameId,
          "currentQuarter": currentQuarter,
          "minsLeftInQtr": minsLeftInQtr,
          "secsLeftInQtr": secsLeftInQtr,
          "awayScore": awayScore,
          "homeScore": homeScore,
          "isOverTime": isOverTime,
          "numOverTime": numOverTime,
          "isHalftime": isHalftime,
          "isEndOfFirst": isEndOfFirst,
          "isEndOfThird": isEndOfThird,
          "isEndOfFourth": isEndOfFourth,
          "isEndOfOverTime": isEndOfOverTime
        });
    
        
      }
    
    
      // storing final games in array
      let completedGamesContainers = await page.$$('article.scoreboard.basketball.final');
    
      for(let i = 0; i < completedGamesContainers.length; i++) {
        
        
        const gameContainer = completedGamesContainers[i];
    
        const teamAbbrevs = await gameContainer.$$eval('.sb-team-abbrev', (nodes) => nodes.map(el => el.innerText));

    
        const awayTeamAbbrev = teamAbbrevs[0].trim();
        const homeTeamAbbrev = teamAbbrevs[1].trim();
    

        const awayScoreStr = await gameContainer.$eval('tr.away > td.total', el => el.innerText.trim());
        const homeScoreStr = await gameContainer.$eval('tr.home > td.total', el => el.innerText.trim());
    
    
        const gameNameId = homeTeamAbbrev + "_" + awayTeamAbbrev;
        
        

        const awayScore = parseInt(awayScoreStr);
        const homeScore = parseInt(homeScoreStr);
    
        if(awayScore == null || awayScore == NaN){
          console.log("Error: issue parsing awayScoreStr of completed game");
          return;
        }
    
        if(homeScore == null || homeScore == NaN){
          console.log("Error: issue parsing homeScoreStr of completed game");
          return;
        }
    
        allGamesArray.push({
          "gameStatus": "completed",
          "lookupId": gameNameId,
          "awayScore": awayScore,
          "homeScore": homeScore
        });
      }


      scrapedGameData = allGamesArray;
    }

    function findGameUpdates(){

      let gameUpdates = [];
      let justStartedGames = [];
      let justCompletedGames = [];
    
      for(let game of scrapedGameData){
    
        const lookupId = game.lookupId;
        
        const cachedGame = cachedGameData.get(lookupId);


        if(cachedGame == undefined){

          if(game.gameStatus == "completed"){
            continue;
          }

          console.log("Error finding game updates because the cached version does not exist");
          console.log(game.lookupId);
          return;
        }
    
        // if the game status has changed
        if(cachedGame.gameStatus != game.gameStatus){
    
          // if the game has just started
          if(cachedGame.gameStatus == "upcoming" && game.gameStatus == "inprogress"){
            
            justStartedGames.push({
              "gameId": cachedGame.gameId,
              ...game
            });
          }
          // if the game has just finished
          else if(cachedGame.gameStatus == "inprogress" && game.gameStatus == "completed"){
            justCompletedGames.push({
              "gameId": cachedGame.gameId,
              ...game
            });
          }
          else{
            console.log("Error: there is something wrong with the gameStatus's for the cachedGame and scrapedGames");
            return;
          }
    
          gameUpdates.push({
            "gameId": cachedGame.gameId,
            ...game
          });
          
          continue;
        }
    
    
        // if any changes to the progess of the game or the score have been made
        if( cachedGame.homeScore != game.homeScore || 
            cachedGame.awayScore != game.awayScore || 
            cachedGame.secsLeftInQtr != game.secsLeftInQtr ||
            cachedGame.minsLeftInQtr != game.minsLeftInQtr ||
            cachedGame.currentQuarter != game.currentQuarter ||
            cachedGame.isHalftime != game.isHalftime ||
            cachedGame.isOverTime != game.isOverTime ||
            cachedGame.isEndOfFirst != game.isEndOfFirst ||
            cachedGame.isEndOfThird != game.isEndOfThird ||
            cachedGame.isEndOfFourth != game.isEndOfFourth ||
            cachedGame.numOverTime != game.numOverTime ||
            cachedGame.isEndOfOverTime != game.isEndOfOverTime
          ){
            gameUpdates.push({
              "gameId": cachedGame.gameId,
              ...game
            });
        }
      }
    

      game_updates = gameUpdates;
      just_started_games = justStartedGames;
      just_completed_games = justCompletedGames;
  
    }

  
    

  } // end scrapeScores function


  function updateCache(){

    for (let game of game_updates){
 
      let lookupId = game.lookupId;

      cachedGameData.set(lookupId, {...game});
    }

    console.log(game_updates);
  
  }

  function initializeCache(mutable_cached_data, initialGames){

    for (let [key, value] of initialGames){
   
      console.log(key, value);
      mutable_cached_data.set(key, {...value});
    }


  }


  async function applyUpdates(){

    if(game_updates.length == 0){
      return;
    }

    // write to database
    
    const gamesRef = db.collection("games");
    const gameStatusUpdatesRef = db.collection("game_status_updates");

    const batch = db.batch();

    // update all the games in games collection
    game_updates.forEach((game) => {

      const docRef = gamesRef.doc(game.gameId);

      batch.update(docRef, {
        "gameStatus": game.gameStatus,
        "homeScore": game.homeScore,
        "awayScore": game.awayScore,
        "currentQuarter": game.currentQuarter || 0,
        "minsLeftInQtr": game.minsLeftInQtr || 0,
        "secsLeftInQtr": game.secsLeftInQtr || 0,
        "isOverTime": game.isOverTime || false,
        "isEndOfFirst": game.isEndOfFirst || false,
        "isEndOfThird": game.isEndOfThird || false,
        "isEndOfFourth": game.isEndOfFourth || false,
        "isHalftime": game.isHalftime || false,
        "isEndOfOverTime": game.isEndOfOverTime || false,
        "numOverTime": game.numOverTime || false
      });
    });



    just_started_games.forEach((game) => {

      const docRef = gameStatusUpdatesRef.doc();

      batch.set(docRef, {
        "gameId": game.gameId,
        "gameStatusUpdateType": "started",
      });
    });


    just_completed_games.forEach((game) => {

      const docRef = gameStatusUpdatesRef.doc();

      batch.set(docRef, {
        "gameId": game.gameId,
        "gameStatusUpdateType": "completed",
        "gameCompletionDateTime": firestore.FieldValue.serverTimestamp(),
        "homeScore": game.homeScore,
        "awayScore": game.awayScore
      });
    });


    await batch.commit();

	  // console.log("---------- finished writing to firestore -------------");

    // console.log("Game updates:");
    // console.log(game_updates);
    // console.log("");

    // console.log("Just started games:");
    // console.log(just_started_games);
    // console.log("");

    // console.log("Just completed games:");
    // console.log(just_completed_games);
  }

  async function closeBrowserIfAllGamesHaveCompleted(){

    // loop through all the games in the cache
    for(let val of cachedGameData.values()){

      if(val.gameStatus != "completed"){
        return;
      }
    }

    notifyManagerOfCompletion();

    // if(browser != null){
          
    //   let emailMessage = "";

    //   await browser.close();

    //   if(browser.isConnected()){
    //     emailMessage = "Error somewhere: the browser is still connected.";
    //   }
    //   else{
    //     emailMessage = "Browser was successfully closed.";
    //   }

    //   emailMessage += " Initiated by the scoreScraper detecting that all the games have completed.";

    //   console.log(emailMessage);

    //   // send email saying that the scraper has closed the browser and no longer is looking for scores
    //   await sendEmail("Score Scraper Browser Close", emailMessage);
    //   console.log("Sent email about closing browser");
    // }
    // else{
    //   console.log("Browser obj was already null so nothing will happen");
    // }


    // // send email saying that the scraper has closed the browser and no longer is looking for scores
    // await sendEmail("Score Scraper Closed Browser", "Closed browser");
    // console.log("Sent email about closing browser");
  }


  function notifyManagerOfCompletion(){

    pm2.connect(function() {

      let parentId = null;

      // Find the IDs of who you want to send to
      pm2.list(function(err, processes) {
          for (var i in processes) {
            if(processes[i].name == 'scoreScraperManager') {
                parentId = processes[i].pm_id;
                break;
            }
          }
      
          if(parentId == null){
              console.log("parent id is null");
              return;
          }

          // Call this once for each neighborIds
          pm2.sendDataToProcessId({
              data : {
                  message : "finished"
              },
              topic: 'scraper status',
              id: parentId
          }, (err, res) => {
              if(err){
                  console.log(err);
              }
          });
      });
  });


  }
}



start();