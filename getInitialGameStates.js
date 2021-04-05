const {db} = require("./db");
const {firestore} = require("firebase-admin");

module.exports = async function getInitialGameStates(){

  const gamesRef = db.collection("games");
  
  const snapshot = await gamesRef
  // .where("gameStatus", "==", "upcoming")
  .where("gameStatus", "in", ["upcoming", "inprogress"])
                                  // .where("gameStartDateTime", ">=", firestore.Timestamp.fromDate(new Date()))
                                  .get();
  
  if(snapshot.empty){
    console.log("No upcoming games found. There is probably an error because this script should only be triggered on days where there are games on.");
    return;
  }
  
  const docs = snapshot.docs;
  
  let initialGameStates = new Map();
  
  for(let doc of docs) {
  
    const {gameId, homeTeam, awayTeam, gameStatus, gameStartDateTime} = doc.data();
  
    const homeTeamAbbrev = homeTeam.split(" ")[0];
    const awayTeamAbbrev = awayTeam.split(" ")[0];
    
    const lookupId = homeTeamAbbrev + "_" + awayTeamAbbrev;
    
    const gameData = {
      "gameId": gameId,
      "homeTeam": homeTeam,
      "awayTeam": awayTeam,
      "gameStatus": gameStatus,
      "currentQuarter": 0,
      "minsLeftInQtr": null,
      "secsLeftInQtr": null,
      "isOverTime": false,
      "isEndOfFirst": false,
      "isEndOfThird": false,
      "isEndOfFourth": false,
      "isHalftime": false,
      "isEndOfOverTime": false,
      "numOverTime": 0,
      "homeScore": null,
      "awayScore": null
    };
    
    initialGameStates.set(lookupId, gameData);
  }
  
  return initialGameStates;
  }
  