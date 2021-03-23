const admin = require("firebase-admin");
const cron = require("node-cron");

function getAdjustedDate(date){

  let adjustedDate = new Date(date);
  let wasChanged = false;

  let mins = adjustedDate.getUTCMinutes();

  if(mins % 15 != 0){
  
    wasChanged = true
    let adjustedMins = (Math.round(mins/15) * 15) % 60;
    
    adjustedDate.setUTCMinutes(adjustedMins);

    // if the mins was adjusted to the next hour
    if(adjustedMins == 0 && mins > 52) {
     
      adjustedDate.setUTCHours(adjustedDate.getUTCHours() + 1);
      
    }
  }

  return { "wasChanged": wasChanged, "adjustedDate": new Date(adjustedDate) };

}


function customUTCDateStr(date){

  return date.toISOString().replace(/T/, '-').replace(/\..+/, '') .slice(0, -3);
}



const serviceAccount = require('./ServiceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();


function startCron(){

  cron.schedule("0,15,30,45 12-22 * * *", () => {

    console.log("here");

    expirationJob();

  });

}


async function expirationJob() {

  let doesAffectDrafts = false;
  let doesAffectInvitations = false;

  const curDate = new Date();
  const {adjustedDate, wasChanged} = getAdjustedDate(curDate);

  console.log("------------------------------");


  if(wasChanged){
    console.log("Something is wrong with cron job, it is not being executed the 0, 15, 30, and 45 minute mark of the hour");
    // return;
  }

  const expirationDocId = customUTCDateStr(adjustedDate);
  const draftExpirationDocRef = db.collection('draft_expirations_subscriptions').doc(expirationDocId);
  const draftExpirationDoc = await draftExpirationDocRef.get();

  if(!draftExpirationDoc.exists){
    console.log("No draft expiration document")
  }
  else{

    const { draftIds } = draftExpirationDoc.data();

    if(draftIds != null && draftIds.length > 0){

      doesAffectDrafts = true;
    }
  }

  const invitationExpirationDocRef = db.collection('invitation_expirations_subscriptions').doc(expirationDocId);
  const invitationExpirationDoc = await invitationExpirationDocRef.get();

  if(!invitationExpirationDoc.exists){
    console.log("No invitation expiration document")
  }
  else{
    
    const { invitationIds } = invitationExpirationDoc.data();

    if(invitationIds != null && invitationsIds.length > 0){
      doesAffectInvitations = true;
    }
  }

  if(doesAffectDrafts || doesAffectInvitations){

    const expireJobsDocRef = db.collection("expire_jobs").doc("current");

   const res = await expireJobsDocRef.update({
      "doesAffectDrafts": doesAffectDrafts, 
      "doesAffectInvitations": doesAffectInvitations, 
      "expirationLookupStr": expirationDocId
    });
    console.log("just updated the doc in expire_jobs collection...");
  }

  console.log("Expiration Doc Id: " + expirationDocId);
  console.log("doesAffectDrafts:" + doesAffectDrafts);
  console.log("doesAffectInvitations:" + doesAffectInvitations);
  //
  // console.log(customUTCDateStr(curDate));
  // console.log(customUTCDateStr(adjustedDate));


  console.log("------------------------------");


}



startCron();



