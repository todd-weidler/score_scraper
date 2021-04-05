
const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "brokebets-3efe4"
});

const db = admin.firestore();



async function addMockContestToEmulatorDatabase(){

  let contestsRef = db.collection("contests");

  let newMockContestDocRef = contestsRef.doc();
  let contestId = newMockContestDocRef.id;

  let mockUpcomingGames = [
    {
      "homeTeam": "HOU Rockets",
      "awayTeam": "ORL Magic",
      "gameId": "gameId1",
      "gameStartDateTime": admin.firestore.Timestamp.fromDate(new Date()),
      "spreadBet": {
        "player1": "HOU -7",
        "player2": "ORL +7",
        "drafter": "player1"
      },
      "overUnderBet": {
        "player1": "o 225.5",
        "player2": "u 225.5",
        "drafter": "player2"
      }
    },
    {
      "homeTeam": "MIA Heat",
      "awayTeam": "SA Spurs",
      "gameId": "gameId2",
      "gameStartDateTime": admin.firestore.Timestamp.fromDate(new Date()),
      "spreadBet": {
        "player1": "SA -3",
        "player2": "MIA +3",
        "drafter": "player2"
      },
    },
    {
      "homeTeam": "GS Warriors",
      "awayTeam": "NY Knicks",
      "gameId": "gameId3",
      "gameStartDateTime": admin.firestore.Timestamp.fromDate(new Date()),
      "overUnderBet": {
        "player1": "o 218",
        "player2": "u 218",
        "drafter": "player1"
      }
    }
  ]

  const res = await newMockContestDocRef.set({
    "contestStatus": "upcoming",
    "contestId": contestId,
    "numBets": 4,
    "upcoming_games": mockUpcomingGames,
    "players": ["player1uid", "player2uid"],
    "player1_uid": "player1uid",
    "player2_uid": "player2uid",
    "player1_uname": "player1uname",
    "player2_uname": "player2uname"
  });

}


async function addMockContestUpdateJobForStartedGame(contestId, gameId){

  let contestsRef = db.collection("update_contests_job_queue");

  const res = await contestsRef.add({
    "gameStatusUpdateType": "started",
    "contestId": contestId,
    "gameId": gameId
  });
}

async function addMockContestUpdateJobForCompletedGame(contestId, gameId){

  let contestsRef = db.collection("update_contests_job_queue");

  const res = await contestsRef.add({
    "gameStatusUpdateType": "completed",
    "contestId": contestId,
    "gameId": gameId,
    "gameCompletionDateTime": admin.firestore.Timestamp.fromDate(new Date()),
    "homeScore": 114,
    "awayScore": 117
  });
}



// addMockContestToEmulatorDatabase();

// addMockContestUpdateJobForStartedGame("OHw04ydiuSROFjU0Oasz", "gameId3");
addMockContestUpdateJobForCompletedGame("OHw04ydiuSROFjU0Oasz", "gameId1");
