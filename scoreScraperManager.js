const { firestore } = require("firebase-admin");
const admin = require("firebase-admin");
const cron = require("node-cron");
// const customUTCDateStr = require("./utils/customUTCDateStr");
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


async function updateScraperJobsDocBeforeFirstGameStart(){

  const gamesRef = db.collection("games");

  const snapshot = await gamesRef
                         .where("gameStatus", "==", "upcoming")
                         .where("gameStartDateTime", ">=", firestore.Timestamp.fromDate(new Date()))
                         .orderBy("gameStartDateTime").limit(1).get();

  if(snapshot.empty){
    console.log("No upcoming games were found");
    return false;
  }

  const gameStartDateTime = snapshot.docs[0].data().gameStartDateTime.toDate();

  if(gameStartDateTime == null){
    console.log("Error in database: the document has null value for the field gameStartDateTime");
    return false;
  }

  let tommorrowAtNoon = new Date();
  const curDay = tommorrowAtNoon.getUTCDate();

  tommorrowAtNoon.setUTCDate(curDay + 1);
  tommorrowAtNoon.setUTCHours(12);
  tommorrowAtNoon.setUTCMinutes(0);

  if(gameStartDateTime >= tommorrowAtNoon){
    console.log("No games need to be scraped today");
    return false;
  }

  
  let mins = gameStartDateTime.getUTCMinutes();

  gameStartDateTime.setUTCMinutes(mins - 15);

  const numMilliseconds = Math.max(gameStartDateTime.getTime() - new Date().getTime(), 0);
  
  console.log(gameStartDateTime.toLocaleString());
  console.log(numMilliseconds);
  
  setTimeout(async () => {

    await updateCurrentScraperJobDoc("start");

    console.log("finished");

    areThereGamesToday = true;

  }, numMilliseconds);
}

async function updateCurrentScraperJobDoc(jobType){

  const scraperJobDocRef = db.collection("scraper_jobs").doc("current");

  const res = await scraperJobDocRef.update({
    "timestamp": firestore.FieldValue.serverTimestamp(),
    "jobType": jobType 
  });
}

let areThereGamesToday = false;

function startCron(){

  // "0 12 * * *"
  cron.schedule("0 12 * * *", async function(){
    console.log("getting earliest start time...");
    await updateScraperJobsDocBeforeFirstGameStart();
  });

  cron.schedule("0 3 * * *", () => {
    if(areThereGamesToday){
      areThereGamesToday = false;
      updateCurrentScraperJobDoc("stop");
    }
  });
}


startCron();