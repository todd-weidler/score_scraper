const { firestore } = require("firebase-admin");
const admin = require("firebase-admin");
const cron = require("node-cron");
const sleep = require('util').promisify(setTimeout);
// const customUTCDateStr = require("./utils/customUTCDateStr");
const {exec} = require('child_process');

require('dotenv').config();

const sendEmail = require("./utils/sendEmail");
const serviceAccount = require('./ServiceAccountKey.json');


const isTesting = false;

if(isTesting){

  admin.initializeApp({
    projectId: "brokebets-3efe4"
  });
}
else{
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}


const db = admin.firestore();



async function getTimeUntilFirstGameStarts(){

  const gamesRef = db.collection("games");

  const snapshot = await gamesRef
                         .where("gameStatus", "==", "upcoming")
                         .where("gameStartDateTime", ">=", firestore.Timestamp.fromDate(new Date()))
                         .orderBy("gameStartDateTime").limit(1).get();

  if(snapshot.empty){
    console.log("No upcoming games were found");
    return -1;
  }

  const gameStartDateTime = snapshot.docs[0].data().gameStartDateTime.toDate();

  if(gameStartDateTime == null){
    console.log("Error in database: the document has null value for the field gameStartDateTime");
    return null;
  }

  let tommorrowAtNoon = new Date();
  const curDay = tommorrowAtNoon.getUTCDate();

  tommorrowAtNoon.setUTCDate(curDay + 1);
  tommorrowAtNoon.setUTCHours(12);
  tommorrowAtNoon.setUTCMinutes(0);

  if(gameStartDateTime >= tommorrowAtNoon){
    console.log("No games need to be scraped today");
    return -2;
  }

  
  let mins = gameStartDateTime.getUTCMinutes();

  gameStartDateTime.setUTCMinutes(mins - 15);

  const numMilliseconds = Math.max(gameStartDateTime.getTime() - new Date().getTime(), 0);
  
  console.log(gameStartDateTime.toLocaleString());
  
  return numMilliseconds;
}

async function startScoreScraperBeforeFirstGame(){

  const numMilliseconds = await getTimeUntilFirstGameStarts();

  console.log("numMilliseconds until first game start time: " + numMilliseconds);

  if(numMilliseconds >= 0){

    await sleep(numMilliseconds);

    return new Promise((resolve, reject) => {

      exec("pm2 start scoreScraper.js -f --no-autorestart", (error, _) => {
        if(error){
          console.warn("Error: "+error);
          resolve(false);
        }
        else{
          console.log("finished starting scoreScraper.js");
          resolve(true);
        }
      });
    });
  }
  else if(numMilliseconds == null){
    console.log("Error somewhere: numMilliseconds is null");
    return false;
  }
  else{
    console.log("There are no games today so it will do nothing");
    return false;
  }
}

// async function updateCurrentScraperJobDoc(jobType){

//   const scraperJobDocRef = db.collection("scraper_jobs").doc("current");

//   const res = await scraperJobDocRef.update({
//     "timestamp": firestore.FieldValue.serverTimestamp(),
//     "jobType": jobType 
//   });
// }

// let areThereGamesToday = false;

async function startCron(){

  let areThereGamesToday = false;

  const args = process.argv.slice(2);
  console.log(args);

  if(args.includes("-ri") && !areThereGamesToday){ 
    console.log("Will run immediately")
    areThereGamesToday = await startScoreScraperBeforeFirstGame();
  }


  // "0 12 * * *"
  cron.schedule("0 12 * * *", async () => {
    console.log("getting earliest start time...");
    areThereGamesToday = await startScoreScraperBeforeFirstGame();
  });

  // stops scoreScraper 
  cron.schedule("0 3 * * *", () => {
    if(areThereGamesToday){
      areThereGamesToday = false;

      exec("pm2 stop scoreScraper.js", async (error, _) => {
        await sendEmail("Score Scraper Browser Close Event", 
                        error ? `Error closing browser\nError message: ${error}` : 
                        "Browser closed successfully. Initiated by cron from scoreScraperManager");

        console.log("Sent email about closing browser");
      });
    }
  });

  // listens for messages from scoreScraper
  process.on('message', (packet) => {

    const { data : { message } } = packet;
  
    console.log(message);
  
    if(message == "finished"){
        exec("pm2 stop scoreScraper.js", async (error, _) => {

          areThereGamesToday = false;
          await sendEmail("Score Scraper Browser Close Event", 
                          error ? `Error closing browser\nError message: ${error}` : 
                          "Browser closed successfully. Initiated by scoreScraper");
  
          console.log("Sent email about closing browser");
        });
    }
  });
}



startCron();