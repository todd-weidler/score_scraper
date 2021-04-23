const admin = require("firebase-admin");
const serviceAccount = require('../ServiceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();


async function deleteOldInvitationDocsInDB(){

    const invitationsRef = db.collection("invitations");

    const res1 = await invitationsRef.where("invitor_uid", "in", ["testuid", "testuseruid", "useruidd", "testuser"]).get();
    const res2 = await invitationsRef.where("recipient_uid", "==", "testuid").get();
    const res3 = await invitationsRef.where("recipient_uname", "==", "testTodd123").get();
    const res4 = await invitationsRef.where("invitor_uname", "==", "testTodd123").get();
    const res5 = await invitationsRef.where("invitationStatus", "in", ["pending", "expired", "accepted"]).get();

    let docIds = [];

    docIds.push(...getDocIds(res1));
    docIds.push(...getDocIds(res2));
    docIds.push(...getDocIds(res3));
    docIds.push(...getDocIds(res4));
    docIds.push(...getDocIds(res5));
   
    if(docIds.length > 0){
        await deleteDocs(docIds, invitationsRef);
    }
    else{
        console.log("No invitation docs will be deleted");
    }
}

async function deleteInvitationExpiredDocs(){

    const expiredInvitationsRef = db.collection("invitation_expiration_subscriptions");

    const res1 = await expiredInvitationsRef.where("invitationIds", "==", []).get();

    let docIds = [];

    docIds.push(...getDocIds(res1));

    if(docIds.length > 0){
        await deleteDocs(docIds, expiredInvitationsRef);
    }
    else{
        console.log("No invitation expired docs will be deleted");
    }
}


async function deleteOldDraftsDocsInDB(){

    const draftsRef = db.collection("drafts");

    const res1 = await draftsRef.where("draftStatus", "in", ["active", "expired"]).get();

    let docIds = [];

    docIds.push(...getDocIds(res1));

    
    if(docIds.length > 0){
        await deleteDocs(docIds, draftsRef);
    }
    else{
        console.log("No old draft docs will be deleted");
    }
}

async function deleteDraftExpiredDocs(){

    const expiredDraftsRef = db.collection("draft_expiration_subscriptions");

    const res1 = await expiredDraftsRef.where("draftIds", "==", []).get();

    let docIds = [];

    docIds.push(...getDocIds(res1));


    if(docIds.length > 0){
        await deleteDocs(docIds, expiredDraftsRef);
    }
    else{
        console.log("No invitation expired docs will be deleted");
    }
}




// 
async function deleteOldGameDocs(){

    const gamesRef = db.collection("games");

    const res1 = await gamesRef.where("gameStatus", "not-in", ["completed"]).get();

    let docIds = [];

    docIds.push(...getDocIds(res1));

    if(docIds.length > 0){
        await deleteDocs(docIds, gamesRef);
    }
    else{
        console.log("No old game docs will be deleted");
    }
}


function getDocIds(res){
    if(!res.empty){

        const docs = res.docs;

        const docIds = docs.map(doc => doc.id);
        return docIds;
    }
    return [];
}

async function deleteDocs(docIds, collectionRef){

    try {
        await Promise.all(
            docIds.map((docId) =>
            collectionRef.doc(docId).delete()
            )
        );
    } catch (e) {
        console.log(e);
    }
}

async function start(){

    await deleteOldGameDocs();
}

start();