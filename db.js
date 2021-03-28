
const admin = require("firebase-admin");
const serviceAccount = require('./ServiceAccountKey.json');

const isTesting = true;

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

module.exports.db = db;