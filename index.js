var email = require("./email.js").email
console.log("email html loaded")
const port = process.env.PORT || 4000
console.log("port selected = " + port)
require('dotenv').config()
console.log("env vars loaded")
const express = require('express')
console.log("express loaded")
const bodyParser = require('body-parser')
console.log("body-parser loaded")
const request = require('request')
console.log("request loaded")
const path = require('path')
console.log("path loaded")
const app = express()
console.log("app created from express")
const admin = require('firebase-admin')
console.log("firebase admin loaded")
const nodemailer = require("nodemailer")
console.log("email client loaded for support")
const favicon = require('serve-favicon')
console.log("favicon loaded")
const CryptoJS = require("crypto-js")
console.log("Encryption module loaded")
// Initialize admin credentials for db
admin.initializeApp({
  credential: admin.credential.cert({
          "type": "service_account",
          "project_id": "easeattendance-c68ed",
          "private_key_id": process.env.firebase_admin_key_id,
          "private_key": process.env.firebase_admin_key,
          "client_email": "easeattendance-c68ed@appspot.gserviceaccount.com",
          "client_id": process.env.firebase_admin_client_id,
          "auth_uri": "https://accounts.google.com/o/oauth2/auth",
          "token_uri": "https://oauth2.googleapis.com/token",
          "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
          "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/easeattendance-c68ed%40appspot.gserviceaccount.com"
      }
  )
})
console.log("admin app initialized")
// Create connection to cloud firestore
const db = admin.firestore();
console.log("cloud firestore initialized")
// initialize firestore auth
const auth = admin.auth()
console.log("firestore auth initialized")
// Holds information about current Meeting
class Meeting{
  constructor(hostId,meetingName,hostEmail, id,uuid) {
      this.meetingId = id
      this.hostId = hostId
      this.meetingName = meetingName
      this.hostEmail = hostEmail
      this.hostUID = null
      this.messageLog = []
      this.recordLog = []
      this.meetingStart = new Date()
      this.uuid = uuid

  }
}

// Dictionary of current meetings
Meetings = {}
console.log("dictionary of current meetings created")
// Initialize nodemailer to send messages for support
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.admin_email,
    pass: process.env.admin_pass
  }
});
console.log("nodemailer transport initialized")
// Initialize app config

app.use(favicon(path.join(__dirname, 'favicon.ico')))
console.log("favicon initialized")
app.use(express.urlencoded({
  extended: true
}))
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, '/public')));
console.log("express app preferences loaded")
// Initialize URL paths

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/index.html'));
})
app.get('/features', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/features.html'));
})

app.get('/about-us', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/about-us.html'));
})

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/privacy.html'));
})

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/terms.html'));
})

app.get('/documentation', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/documentation.html'));
})
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/dashboard.html'));
})
app.get('/forgotpass', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/forgotpass.html'));
})
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/login.html'));
})
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/signup.html'));
})
app.get('/support', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/support.html'));
})
app.get('/verify', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/verify.html'));
})
app.get('/authorize', (req, res) => {
    const authorizationCode = req.query.code
    console.log(authorizationCode)
    if(authorizationCode && authorizationCode !== ""){
        try{
            request({
                url: 'https://zoom.us/oauth/token?grant_type=authorization_code&' + 'code=' + authorizationCode + '&redirect_uri=https://www.easeattendance.com/authorize',
                method: 'POST',
                json: true,
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(process.env.zoom_client_id + ':' + process.env.zoom_client_secret).toString('base64')
                }
            }, (error, httpResponse, body) => {
                if (error) {
                    console.error(error)
                    res.sendFile(path.join(__dirname + '/public/index.html'));
                } else {
                    const accessToken = body.access_token
                    const refreshToken = body.refresh_token

                    request({
                        url: 'https://api.zoom.us/v2/users/me',
                        method: 'GET',
                        json: true,
                        headers: {
                            'Authorization': "Bearer " + accessToken
                        }
                    }, (error, httpResponse, body) => {
                        if (error) {
                            console.error(error)
                            res.sendFile(path.join(__dirname + '/public/index.html'));
                        } else {
                            const userID = body.id
                            const userFirstName = body.first_name
                            const userLastName = body.last_name
                            const userEmail = body.email
                            const userAccountID = body.account_id
                            if(userID && userID !== ""){
                                db.collection("ZoomOAuth").doc(userID).set({
                                    userID: userID,
                                    firstName: userFirstName,
                                    lastName: userLastName,
                                    email: userEmail,
                                    userAccountID: userAccountID,
                                    refreshToken: refreshToken
                                }, {merge: true}).then(() => {
                                    console.info("User " + userFirstName + " " + userLastName + " with email " + userEmail + " has downloaded the Ease Attendance app")
                                    res.sendFile(path.join(__dirname + '/public/signup.html'));
                                }).catch((error) => {
                                    console.error(error.message)
                                    res.sendFile(path.join(__dirname + '/public/index.html'));
                                })
                            }
                            else{
                                res.sendFile(path.join(__dirname + '/public/index.html'));
                            }

                        }
                    })
                }
            })

        }
        catch(error){
            console.error(error.message)
            res.sendFile(path.join(__dirname + '/public/index.html'));
        }
    }
    else{
        res.sendFile(path.join(__dirname + '/public/index.html'));
    }
})
app.get('/zoomverify/verifyzoom.html', (req, res) => {
    res.send(process.env.zoom_verification_code)
})

// function to send messages for https://www.easeattendance.com/support
app.post('/support-message', (req,res) => {
  const message = "email from: " + req.body.email + " with name: " + req.body.Name + " with message: " + req.body.message
  var mailOptions = {
    from: process.env.admin_email,
    to: process.env.admin_email,
    subject: 'Support Email from Ease Attendance: ' + req.body.email,
    text: message
  };
  var mailOptionsUser = {
    from: process.env.admin_email,
    to: req.body.email,
    subject: "Ease Attendance Support",
    html: email
  };
  if(req.body.email){
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.error(error);
      } else {
        console.info('Email sent: ' + info.response);
      }
    });
    transporter.sendMail(mailOptionsUser, function(error, info){
      if (error) {
        console.error(error);
      } else {
        console.info('Email sent: ' + info.response);
      }
    });
  }
  res.status(200);
  res.send()
})

// Function to handle zoom webhooks

async function handleZoomPost(req){
    const body = req.body
    const host_id = body.payload.object.host_id
    if(body.event === "meeting.started"){
        if(!Meetings[host_id]){
            db.collection("ZoomOAuth").doc(host_id).get().then((doc)=>{
                // Create meeting in meeting dictionary
                Meetings[host_id] = new Meeting(host_id, body.payload.object.topic, doc.data().email, body.payload.object.id,body.payload.object.uuid)
                Meetings[host_id].hostUID = doc.data().firebaseID
                // Add meeting started to record log
                let currentDate = new Date()
                let recordString = "Meeting: " + body.payload.object.topic + " has started " + "with ID: " + body.payload.object.id + "  " + currentDate
                let messageStringID = "meeting.id " + body.payload.object.id
                let messageStringStart = "meeting.started " + body.payload.object.topic
                Meetings[host_id].recordLog.push(CryptoJS.AES.encrypt(recordString,doc.data().firebaseID).toString())
                // push messages that set meeting ID and meeting Name in front end
                Meetings[host_id].messageLog.push(CryptoJS.AES.encrypt(messageStringID,doc.data().firebaseID).toString())
                Meetings[host_id].messageLog.push(CryptoJS.AES.encrypt(messageStringStart,doc.data().firebaseID).toString())
                console.log("Meeting started: " + body.payload.object.topic)
                // update CurrentMeetings on firebase (this automatically updates the list on the front end because client is listening to updates on CurrentMeetings)
                db.collection("CurrentMeetings").doc(Meetings[host_id].hostUID).set({
                    messages: Meetings[host_id].messageLog
                }).then(()=>{
                }).catch((error)=>{
                    console.error(error.message)
                })
            }).catch((error)=>{
                console.error(error.message)
            })
        }
        else{
            var tryCounterA = 0
            var tryStartMeetingInterval = setInterval(() => {
                if(!Meetings[host_id]){
                    db.collection("ZoomOAuth").doc(host_id).get().then((doc)=>{
                        // Create meeting in meeting dictionary
                        Meetings[host_id] = new Meeting(host_id, body.payload.object.topic, doc.data().email, body.payload.object.id,body.payload.object.uuid)
                        Meetings[host_id].hostUID = doc.data().firebaseID
                        // Add meeting started to record log
                        let currentDate = new Date()
                        let recordString = "Meeting: " + body.payload.object.topic + " has started " + "with ID: " + body.payload.object.id + "  " + currentDate
                        let messageStringID = "meeting.id " + body.payload.object.id
                        let messageStringStart = "meeting.started " + body.payload.object.topic
                        Meetings[host_id].recordLog.push(CryptoJS.AES.encrypt(recordString,doc.data().firebaseID).toString())
                        // push messages that set meeting ID and meeting Name in front end
                        Meetings[host_id].messageLog.push(CryptoJS.AES.encrypt(messageStringID,doc.data().firebaseID).toString())
                        Meetings[host_id].messageLog.push(CryptoJS.AES.encrypt(messageStringStart,doc.data().firebaseID).toString())
                        console.log("Meeting started: " + body.payload.object.topic)
                        // update CurrentMeetings on firebase (this automatically updates the list on the front end because client is listening to updates on CurrentMeetings)
                        db.collection("CurrentMeetings").doc(Meetings[host_id].hostUID).set({
                            messages: Meetings[host_id].messageLog
                        }).then(()=>{
                            clearInterval(tryStartMeetingInterval)
                        }).catch((error)=>{
                            console.error(error.message)
                            clearInterval(tryStartMeetingInterval)
                        })
                    }).catch((error)=>{
                        console.error(error.message)
                        clearInterval(tryStartMeetingInterval)
                    })
                }
                else{
                    tryCounterA+=1
                }
                if(tryCounterA >= 10){
                    clearInterval(tryStartMeetingInterval)
                    db.collection("ZoomOAuth").doc(host_id).get().then((doc)=>{
                        // Create meeting in meeting dictionary
                        Meetings[host_id] = new Meeting(host_id, body.payload.object.topic, doc.data().email, body.payload.object.id,body.payload.object.uuid)
                        Meetings[host_id].hostUID = doc.data().firebaseID
                        // Add meeting started to record log
                        let currentDate = new Date()
                        let recordString = "Meeting: " + body.payload.object.topic + " has started " + "with ID: " + body.payload.object.id + "  " + currentDate
                        let messageStringID = "meeting.id " + body.payload.object.id
                        let messageStringStart = "meeting.started " + body.payload.object.topic
                        Meetings[host_id].recordLog.push(CryptoJS.AES.encrypt(recordString,doc.data().firebaseID).toString())
                        // push messages that set meeting ID and meeting Name in front end
                        Meetings[host_id].messageLog.push(CryptoJS.AES.encrypt(messageStringID,doc.data().firebaseID).toString())
                        Meetings[host_id].messageLog.push(CryptoJS.AES.encrypt(messageStringStart,doc.data().firebaseID).toString())
                        console.log("Meeting started: " + body.payload.object.topic)
                        // update CurrentMeetings on firebase (this automatically updates the list on the front end because client is listening to updates on CurrentMeetings)
                        db.collection("CurrentMeetings").doc(Meetings[host_id].hostUID).set({
                            messages: Meetings[host_id].messageLog
                        }).then(()=>{
                        }).catch((error)=>{
                            console.error(error.message)
                        })
                    }).catch((error)=>{
                        console.error(error.message)
                    })
                }
            },3000)
        }
    }
    else if(body.event === "meeting.participant_joined"){
        const participant = body.payload.object.participant
        const participantID = participant.id
        const participantName = participant.user_name
        const participantEmail = participant.email
        console.log("Participant " + participantName + " has joined")

        if(Meetings[host_id] && Meetings[host_id].uuid === body.payload.object.uuid){
            if(Meetings[host_id]){
                let currentDate = new Date()
                let recordString = participantName +  " has joined" + "  " + currentDate
                let messageString = "participant.joined " + participantName
                Meetings[host_id].recordLog.push(CryptoJS.AES.encrypt(recordString,Meetings[host_id].hostUID).toString())
                Meetings[host_id].messageLog.push(CryptoJS.AES.encrypt(messageString,Meetings[host_id].hostUID).toString())
                // update CurrentMeetings on firebase (this automatically updates the list on the front end because client is listening to updates on CurrentMeetings)
                db.collection("CurrentMeetings").doc(Meetings[host_id].hostUID).set({
                    messages: Meetings[host_id].messageLog
                }).then(()=>{

                }).catch((error)=>{
                    console.error(error.message)

                })
            }
        }
        else{
            var tryCounterB = 0
            var tryJoinParticipantInterval = setInterval(() => {
                if(Meetings[host_id] && Meetings[host_id].uuid === body.payload.object.uuid){
                    if(Meetings[host_id]){
                        let currentDate = new Date()
                        let recordString = participantName +  " has joined" + "  " + currentDate
                        let messageString = "participant.joined " + participantName
                        Meetings[host_id].recordLog.push(CryptoJS.AES.encrypt(recordString,Meetings[host_id].hostUID).toString())
                        Meetings[host_id].messageLog.push(CryptoJS.AES.encrypt(messageString,Meetings[host_id].hostUID).toString())
                        // update CurrentMeetings on firebase (this automatically updates the list on the front end because client is listening to updates on CurrentMeetings)
                        db.collection("CurrentMeetings").doc(Meetings[host_id].hostUID).set({
                            messages: Meetings[host_id].messageLog
                        }).then(()=>{
                            clearInterval(tryJoinParticipantInterval)
                        }).catch((error)=>{
                            console.error(error.message)
                            clearInterval(tryJoinParticipantInterval)
                        })
                    }
                    else{
                        clearInterval(tryJoinParticipantInterval)
                    }
                }
                else{
                    tryCounterB += 1
                }
                if(tryCounterB >= 10){
                    clearInterval(tryJoinParticipantInterval)
                }
            },3000)
        }
    }
    else if(body.event === "meeting.participant_left"){
        const participant = body.payload.object.participant
        const participantID = participant.id
        const participantName = participant.user_name
        const participantEmail = participant.email
        console.log("Participant " + participantName + " has left")

        if(Meetings[host_id] && Meetings[host_id].uuid === body.payload.object.uuid){
            if(Meetings[host_id]){
                let currentDate = new Date()
                let recordString = participantName +  " has left" + "  " + currentDate
                let messageString = "participant.left " + participantName
                Meetings[host_id].recordLog.push(CryptoJS.AES.encrypt(recordString, Meetings[host_id].hostUID).toString())
                Meetings[host_id].messageLog.push(CryptoJS.AES.encrypt(messageString, Meetings[host_id].hostUID).toString())
                // update current meetings on firebase
                db.collection("CurrentMeetings").doc(Meetings[host_id].hostUID).set({
                    messages: Meetings[host_id].messageLog
                }).then(()=>{
                }).catch((error)=>{
                    console.error(error.message)
                })
            }
        }
        else{
            var tryCounterC = 0
            var tryLeaveParticipantInterval = setInterval(()=>{
                if(Meetings[host_id] && Meetings[host_id].uuid === body.payload.object.uuid){
                    if(Meetings[host_id]){
                        let currentDate = new Date()
                        let recordString = participantName +  " has left" + "  " + currentDate
                        let messageString = "participant.left " + participantName
                        Meetings[host_id].recordLog.push(CryptoJS.AES.encrypt(recordString, Meetings[host_id].hostUID).toString())
                        Meetings[host_id].messageLog.push(CryptoJS.AES.encrypt(messageString, Meetings[host_id].hostUID).toString())
                        // update current meetings on firebase
                        db.collection("CurrentMeetings").doc(Meetings[host_id].hostUID).set({
                            messages: Meetings[host_id].messageLog
                        }).then(()=>{
                            clearInterval(tryLeaveParticipantInterval)
                        }).catch((error)=>{
                            console.error(error.message)
                            clearInterval(tryLeaveParticipantInterval)
                        })
                    }
                    else{
                        clearInterval(tryLeaveParticipantInterval)
                    }
                }
                else{
                    tryCounterC += 1
                }
                if(tryCounterC >= 10){
                    clearInterval(tryLeaveParticipantInterval)
                }
            },3000)
        }
    }
    else if(body.event === "meeting.ended"){
        // If meeting exists and participant is known
        console.log("Meeting ended: " + body.payload.object.topic)
          if(Meetings[host_id]){
            let currentDate = new Date()
            // save record to data base
              let currentMessages = Meetings[host_id].messageLog
              currentMessages.push(CryptoJS.AES.encrypt("meeting.ended",Meetings[host_id].hostUID).toString())
              let currentRecords = Meetings[host_id].recordLog
              let recordString = "Meeting: " + body.payload.object.topic + " has ended " + "with ID: " + body.payload.object.id + "  " + currentDate
              currentRecords.push(CryptoJS.AES.encrypt(recordString,Meetings[host_id].hostUID).toString())
              let meetingID = Meetings[host_id].meetingId
              let hostUID = Meetings[host_id].hostUID
              let meetingName = Meetings[host_id].meetingName
              let meetingStart = Meetings[host_id].meetingStart
              let uuid = body.payload.object.uuid
              db.collection("Records").add({
                  'Events': currentRecords,
                  'MeetingID': meetingID,
                  'useruid': hostUID,
                  'MeetingName': meetingName,
                  'MeetingStart': meetingStart,
                  'MeetingEnd' : new Date()
              })
                  .then(() => {
                  })
                  .catch((error) => {
                      console.error(error.message);
                  });
              if(Meetings[host_id] && uuid === Meetings[host_id].uuid){
                  db.collection("CurrentMeetings").doc(hostUID).set({
                      messages: currentMessages
                  }).then(()=> {
                      //delete the current meeting when meeting has ended
                      if (Meetings[host_id] && uuid === Meetings[host_id].uuid) {
                          db.collection("CurrentMeetings").doc(hostUID).delete().then(() => {
                              if (Meetings[host_id] && uuid === Meetings[host_id].uuid) {
                                  delete Meetings[host_id]
                              }
                          }).catch((error) => {
                              console.error(error.message)
                          });
                      }
                  }).catch((error)=>{
                      console.error(error.message)
                  })
              }
              else{
                  var tryCounterD = 0
                  var tryEndMeetingInterval = setInterval(()=>{
                      if(Meetings[host_id] && uuid === Meetings[host_id].uuid){
                          db.collection("CurrentMeetings").doc(hostUID).set({
                              messages: currentMessages
                          }).then(()=> {
                              //delete the current meeting when meeting has ended
                              if (Meetings[host_id] && uuid === Meetings[host_id].uuid) {
                                  db.collection("CurrentMeetings").doc(hostUID).delete().then(() => {
                                      clearInterval(tryEndMeetingInterval)
                                      if (Meetings[host_id] && uuid === Meetings[host_id].uuid) {
                                          delete Meetings[host_id]
                                      }
                                  }).catch((error) => {
                                      console.error(error.message)
                                      clearInterval(tryEndMeetingInterval)
                                  });
                              }
                          }).catch((error)=>{
                              console.error(error.message)
                              clearInterval(tryEndMeetingInterval)
                          })
                      }
                      else{
                          tryCounterD += 1
                      }
                      if(tryCounterD >= 10){
                          clearInterval(tryEndMeetingInterval)
                      }
                  },3000)
              }
          }
    }
}
app.post('/api/requests', (req, res) => {
    res.status(200)
    res.send()
    console.log("post request to /api/requests sent ")
    console.log(req.body)
    if(req.headers.authorization === process.env.zoom_verification_token){
        handleZoomPost(req).catch((error)=>{
            console.error(error.message)
        })
    }
})

app.post('/deauthorize', (req, res) => {
  if (req.headers.authorization === process.env.zoom_verification_token) {
    console.log("post request to /deauthorize received " + req.body)
    console.log(req.body)
    res.status(200)
    res.send()
    request({
      url: 'https://api.zoom.us/oauth/data/compliance',
      method: 'POST',
      json: true,
      body: {
        'client_id': req.body.payload.client_id,
        'user_id': req.body.payload.user_id,
        'account_id': req.body.payload.account_id,
        'deauthorization_event_received': req.body.payload,
        'compliance_completed': true
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(process.env.zoom_client_id + ':' + process.env.zoom_client_secret).toString('base64'),
        'cache-control': 'no-cache'
      }
    }, (error, httpResponse, body) => {
      if (error) {
        console.error(error)
      } else {
          const userID = req.body.payload.user_id
          db.collection("ZoomOAuth").doc(userID).get().then((Authdoc) => {
              if(Authdoc.exists){
                  const email = Authdoc.data().email
                  db.collection("ZoomOAuth").doc(userID).delete().then(()=>{
                      console.info("Zoom auth info for user with email: " + email + " deleted")
                  }).catch((error) => {
                      console.error(error.message)
                  })
                  db.collection("Users").where("email", "==",email).get().then((querySnapshot) => {
                      querySnapshot.forEach((Userdoc) => {
                          const firebaseUserID = Userdoc.id
                          auth.deleteUser(firebaseUserID).then(() => {
                              console.info("User deleted from firebase auth for user with email: " + email + " and firebase id: " + firebaseUserID)
                          }).catch((error) => {
                              console.error(error.message)
                          })
                          db.collection("Periods").where("useruid", "==", firebaseUserID).get().then((querySnapshot) => {
                              querySnapshot.forEach((Perioddoc) => {
                                  db.collection("Periods").doc(Perioddoc.id).delete().then(()=> {
                                      console.log("Period deleted for user with email: " + email + " with firebase id: " + firebaseUserID)
                                  }).catch((error) => {
                                      console.error(error.message)
                                  })
                              })
                          }).catch((error) => {
                              console.error(error.message)
                          })
                          db.collection("Records").where("useruid","==",firebaseUserID).get().then((querySnapshot) => {
                              querySnapshot.forEach((Recorddoc) => {
                                  db.collection("Records").doc(Recorddoc.id).delete().then(() => {
                                      db.collection("ZoomOAuth").doc(userID).delete().then(() => {
                                          console.log("Record deleted for user with email: " + email + " with firebase id: " + firebaseUserID)
                                      }).catch((error) => {
                                          console.error(error.message)
                                      })
                                  }).catch((error) => {
                                      console.error(error.message)
                                  })
                              })
                          }).catch((error) => {
                              console.error(error.message)
                          })
                          db.collection("Users").doc(firebaseUserID).delete().then(() => {
                          }).catch((error) => {
                              console.error(error.message)
                          })
                      })
                  }).catch((error) => {
                      console.error(error.message)
                  })
              }
          }).catch((error) => {
              console.error(error.message)
          })
      }
    })

  } else {
    res.status(401)
    res.send()
  }
})


const server = app.listen(port, () => console.log(`Ease Attendance running on server on ${port}!`))
