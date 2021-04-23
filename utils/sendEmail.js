const nodemailer = require("nodemailer");

require('dotenv').config({path: '../.env'});

const transporter = nodemailer.createTransport({
    service: "hotmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
});

// const options = {
//     from: process.env.EMAIL,
//     to: process.env.RECIPIENT_EMAIL,
//     subject: "Hey",
//     text: "Hello nik nak pattywack give a dog a bone \n-Todd's server"
// };

module.exports = async function sendEmail(subject, text){

    const options = {
        from: process.env.EMAIL,
        to: process.env.RECIPIENT_EMAIL,
        subject: String(subject || "No subject"),
        text: String(text || "No message")
    };

    try {
        await transporter.sendMail(options);
    }
    catch(e){
        console.log(e);
    }
}

// sendEmail();