/*
 * Copyright (c) 2021 Ease Attendance - Varun Chitturi
 */
class Meeting{
    constructor(name,id,arr){
        this.name = name
        this.id = id
        this.arr = arr
    }
}
class Participant{
    constructor(first,last,attendance, roster, timeJoined) {
        this.firstName = first
        this.lastName = last
        this.state = attendance
        this.partOfRoster = roster
        this.timeJoined = timeJoined // stores ISO time joined, only changed once when participant joins for first time
    }
}
class PastMeeting{
    constructor(MeetingName, MeetingID, MeetingStart,MeetingEnd,events,docID) {
        this.MeetingName = MeetingName
        this.MeetingID = MeetingID
        this.MeetingStart = MeetingStart
        this.MeetingEnd = MeetingEnd
        this.events = events
        this.docID = docID
    }
}
let Meetings = []
let PastMeetings
let isEditingMeeting = false
let MeetingsdidLoad = false
let Participants = []
let CurrentMessages = []
let EncounteredParticipants = new Set()
let names = []
let CurrentMeeting = ""
let CurrentMeetingID = ""
let meetingIndex = -1
let currentRecordIndex = -1
let editingIndex = 1
let checkVerificationTimer
let notRegisteredCount = 0
let MeetingIsOccurring = false
let ParticipantTableSortBy = "first" // can be "first" or "last" or "time" to sort participants table
let listNamesShown = []
let shouldRefresh = false
let zoomID = -1
let rosterParticipantCount = 0
$("#add-on-registered").prop('disabled',true)
$("#add-on-registered").hide()
const studentTableBlock = "<th scope=\"col\"> <input type=\"text\" placeholder=\"First name\" class=\"form-control student-name student-first-name modal-input\"></th>\n" +
    "<th scope=\"col\"> <input type=\"text\" placeholder=\"Last name\" class=\"form-control student-name modal-input\"></th>\n" +
    "<th scope=\"col\"> <button onclick=\"deleteStudent(this)\" class=\"btn trash-btn\" type=\"button\"><span class=\"iconify\" data-inline=\"false\" data-icon=\"ei:trash\" style=\"font-size: 30px;\"></span></button></th>"

const firestore = firebase.firestore()
const auth = firebase.auth()
function arr_diff (newMess, oldMess) {
    var diff = []
    for(let i = oldMess.length; i < newMess.length;i++){
        diff.push(newMess[i])
    }
    return diff
}

firestore.collection("UpdateBrowser").doc("updateDate").onSnapshot((doc) => {
    if(shouldRefresh) {
        window.location.href = "/dashboard";
    }
    shouldRefresh = true
})

auth.onAuthStateChanged((user) => {
    if (user) {
        firestore.collection("Users").doc(user.uid).onSnapshot((doc) => {
            if(!doc.exists || !doc){
                window.location.href = "/";
            }
        })
        if(user.emailVerified){
            firestore.collection("ZoomOAuth").where("firebaseID","==",user.uid).get().then((querySnapshot)=> {
                querySnapshot.forEach((doc) => {
                    zoomID = doc.data().userID;
                })

                document.getElementById("myTabContent").hidden = false
                document.getElementById("verifyEmail").hidden = true
                document.getElementById("settings-resend-verification-link-button").hidden = true
                document.getElementById("user-name").innerHTML = "Welcome " + user.displayName
                firestore.collection("Periods").where("useruid", "==", user.uid)
                    .onSnapshot((querySnapshot) => {
                        MeetingsdidLoad = false
                        Meetings = []
                        querySnapshot.forEach((doc) => {
                            const currData = doc.data()
                            Meetings.push(new Meeting(currData.periodName, currData.meetingId, currData.studentsNames))
                        })
                        const meetingTable = document.getElementById("my-meetings-table")
                        Meetings.sort(compareMeetings)
                        while (meetingTable.rows.length > 1) {
                            meetingTable.deleteRow(1)
                        }
                        const studentInputTable = document.getElementById("student-input-table")
                        for (let i = Meetings.length - 1; i >= 0; i--) {
                            var currentRow = meetingTable.insertRow(1)
                            currentRow.classList.add("meeting-row")
                            currentRow.addEventListener("click", function () {
                                var index = this.rowIndex
                                currentRecordIndex = index - 1
                                document.getElementById("meeting-modal-title").innerHTML = "Edit Roster"
                                editingIndex = index
                                $('#add-edit-meeting-modal').modal('show');
                                const currentMeeting = Meetings[index - 1]
                                $("#meeting-id-input-field").val(currentMeeting.id)
                                $("#meeting-name-input-field").val(currentMeeting.name)
                                isEditingMeeting = true
                                $("#delete-meeting-button").prop('disabled', false)
                                $("#delete-meeting-button").show()
                                while (studentInputTable.rows.length !== 0) {
                                    studentInputTable.deleteRow(0)
                                }
                                rosterParticipantCount = 0
                                for (let j = 0; j < currentMeeting.arr.length; j++) {
                                    addStudent(CryptoJS.AES.decrypt(currentMeeting.arr[j], user.uid).toString(CryptoJS.enc.Utf8))
                                }
                            })
                            var cell1 = currentRow.insertCell(0)
                            var cell2 = currentRow.insertCell(1)
                            cell1.innerHTML = Meetings[i].name
                            cell2.innerHTML = Meetings[i].id
                            cell2.classList.add("meeting-id-text")
                        }
                        MeetingsdidLoad = true
                        refreshTable()
                    });
                firestore.collection("Records").where("useruid", "==", user.uid)
                    .onSnapshot((querySnapshot) => {
                        document.getElementById("records-search-input-field").value = ""
                        PastMeetings = []
                        querySnapshot.forEach((doc) => {
                            const currData = doc.data()
                            PastMeetings.push(new PastMeeting(currData.MeetingName, currData.MeetingID, currData.MeetingStart, currData.MeetingEnd, currData.Events, doc.id))
                        })
                        const recordTable = document.getElementById("records-table")
                        PastMeetings.sort(comparePastMeetings)
                        while (recordTable.rows.length > 1) {
                            recordTable.deleteRow(1)
                        }
                        const currentRecordTable = document.getElementById("current-record-table")
                        for (let i = PastMeetings.length - 1; i >= 0; i--) {
                            var currentRow = recordTable.insertRow(1)
                            currentRow.classList.add("record-row");
                            currentRow.addEventListener("click", function () {
                                var index = this.rowIndex
                                currentRecordIndex = index - 1
                                const currentMeeting = PastMeetings[index - 1]
                                document.getElementById("current-record-name").innerHTML = "Meeting Name: " + currentMeeting.MeetingName
                                document.getElementById("current-record-id").innerHTML = "Meeting ID: " + currentMeeting.MeetingID
                                document.getElementById("current-record-date").innerHTML = "Date: " + currentMeeting.MeetingStart.toDate().toLocaleString() + " - " + currentMeeting.MeetingEnd.toDate().toLocaleString()
                                $('#meeting-record-modal').modal('show');
                                while (currentRecordTable.rows.length !== 0) {
                                    currentRecordTable.deleteRow(0)
                                }
                                for (let j = 0; j < currentMeeting.events.length; j++) {
                                    var row = currentRecordTable.insertRow(currentRecordTable.rows.length)
                                    var cell1 = row.insertCell(0);
                                    let currentRecord = CryptoJS.AES.decrypt(currentMeeting.events[j], user.uid).toString(CryptoJS.enc.Utf8);
                                    currentRecord = currentRecord.split(" ")
                                    let currentRecordDate = ""
                                    for (let k = currentRecord.length - 9; k < currentRecord.length; k++) {
                                        currentRecordDate += currentRecord[k];
                                        if (k !== currentRecord.length - 1) {
                                            currentRecordDate += " ";
                                        }
                                    }
                                    currentRecord.splice(currentRecord.length - 9, 9)
                                    currentRecord = currentRecord.join(" ")
                                    const currentRecordLocaleDate = new Date(currentRecordDate)
                                    currentRecord += " at: " + currentRecordLocaleDate.toLocaleString()
                                    cell1.innerHTML = currentRecord
                                }
                            })
                            var cell1 = currentRow.insertCell(0)
                            var cell2 = currentRow.insertCell(1)
                            var cell3 = currentRow.insertCell(2)
                            currentRow.style.backgroundColor = "#ffffff"
                            cell1.innerHTML = PastMeetings[i].MeetingName
                            cell2.innerHTML = PastMeetings[i].MeetingID
                            cell3.innerHTML = PastMeetings[i].MeetingStart.toDate().toLocaleString()
                            cell2.classList.add("meeting-id-text")
                        }

                    });
                firestore.collection("CurrentMeetings").doc(zoomID).onSnapshot((doc) => {
                    if (MeetingsdidLoad) {
                        evaluateParticipantTable(doc)
                    } else {
                        let getMeetingInterval = setInterval(() => {
                            if (MeetingsdidLoad) {
                                evaluateParticipantTable(doc)
                                clearInterval(getMeetingInterval)
                            }
                        }, 500)
                    }
                }, (error) => {
                    redNotification("Problem connecting to server")
                    console.error(error.message)
                })
            })
        }
        else{
            //user email is not verified
            checkVerificationStatus()
            document.getElementById("myTabContent").hidden = true
            document.getElementById("verifyEmail").hidden = false
            document.getElementById("settings-resend-verification-link-button").hidden = false
            document.getElementById("verifyEmailDescription").innerHTML = "Your current email is now " + auth.currentUser.email + " and a verification email has been sent. If you did not receive it, click on resend the verification link"
        }
    } else {
        //user not signed in
        window.location.href = "/";
    }
});
document.getElementById("meeting-id-attendance").hidden = true
$("input").on("click", function(){
    $(this).removeClass('is-invalid')
})
$(function() {
    $('#meeting-id-input-field').on('keypress', function(e) {
        if (e.which === 32 || document.getElementById("meeting-id-input-field").value.length >= 11){
            return false;
        }
    });
});
$('#meeting-id-input-field').on('paste', function (event) {
    if (event.originalEvent.clipboardData.getData('Text').match(/[^\d]/)) {
        event.preventDefault();
    }
});

function updateParticipantTable(){
    if( document.getElementById("present-filter").classList.contains("filter-active")){
        filterClick("present-filter")
    }
    else if( document.getElementById("all-filter").classList.contains("filter-active")){
        filterClick("all-filter")
    }
    else if( document.getElementById("absent-filter").classList.contains("filter-active")){
        filterClick("absent-filter")
    }
    else if( document.getElementById("left-meeting-filter").classList.contains("filter-active")){
        filterClick("left-meeting-filter")
    }
    else if( document.getElementById("not-registered-filter").classList.contains("filter-active")){
        filterClick("not-registered-filter")
    }
}
function refreshTable(){
    document.getElementById("refresh").disabled = true
    document.getElementById("refresh-cover").classList.add("running")
    document.getElementById("ld-spin").style.display = "block"
    Participants = []
    CurrentMessages = []
    CurrentMeeting = ""
    CurrentMeetingID = ""
    meetingIndex = -1
    setTimeout(()=>{
        firestore.collection("CurrentMeetings").doc(zoomID).get().then((doc)=>{
            evaluateParticipantTable(doc)
        }).catch((error)=>{
            redNotification(error.message)
            document.getElementById("ld-spin").style.display = "none"
            document.getElementById("refresh").disabled = false
            document.getElementById("refresh-cover").classList.remove("running")
            updateParticipantTable()
        })
        document.getElementById("ld-spin").style.display = "none"
        document.getElementById("refresh").disabled = false
        document.getElementById("refresh-cover").classList.remove("running")
    },1000)
}
function decryptMessages(messages){
    for(let i = 0; i < messages.length; i++){
        const currentMessage = CryptoJS.AES.decrypt(messages[i], auth.currentUser.uid).toString(CryptoJS.enc.Utf8);
        console.log(currentMessage)
    }
}
function evaluateParticipantTable(doc){
    if(doc.data()){
        const meetingMessages = doc.data().messageLog
        // newCalculated and newMessages are created to make sure that newMessages holds the value and not the reference
        const newCalculated = arr_diff(meetingMessages,CurrentMessages)
        var newMessages = []
        for(let i = 0; i < newCalculated.length; i++){
            CurrentMessages.push(newCalculated[i])
            newMessages.push(newCalculated[i])
        }
        // add new messages to current messages
        if(meetingMessages.length === 0){
            document.getElementById("status-dot").classList.remove("dot-warning")
            document.getElementById("status-dot").classList.remove("dot-success")
            document.getElementById("status-dot").classList.add("dot-danger")
            document.getElementById("currentMeeting-name").innerHTML = "No Meeting Has Started"
            document.getElementById("meeting-id-attendance").value = ""
            document.getElementById("meeting-id-attendance").hidden = true
            CurrentMeeting = ""
            EncounteredParticipants = new Set()
            CurrentMeetingID = ""
            CurrentMessages = []
            Participants = []
            document.getElementById("current-participants").innerHTML = ""
            document.getElementById("current-participant-number").innerHTML = ""
            meetingIndex = -1
            clearTable()
        }
        for(var j = 0; j < newMessages.length; j++){
            const currentMessage = CryptoJS.AES.decrypt(newMessages[j], auth.currentUser.uid).toString(CryptoJS.enc.Utf8);
            const data = currentMessage.split(" ")
            const eventType = data[0]
            if(eventType === "meeting.started"){
                EncounteredParticipants = new Set()
                MeetingIsOccurring = true
                const participantTable = document.getElementById("participant-table")
                while(participantTable.rows.length > 1){
                    participantTable.deleteRow(1)
                }
                document.getElementById("meeting-id-attendance").hidden = false
                var meetingName = ""
                for(i = 1; i < data.length;i++){
                    meetingName += data[i] + " "
                }
                CurrentMeeting = meetingName
                document.getElementById("status-dot").classList.remove("dot-danger")
                if(meetingIndex === -1){
                    document.getElementById("status-dot").classList.remove("dot-success")
                    document.getElementById("status-dot").classList.add("dot-warning")
                    document.getElementById("currentMeeting-name").innerHTML = "Meeting: " + meetingName
                }
                else{
                    document.getElementById("status-dot").classList.remove("dot-warning")
                    document.getElementById("status-dot").classList.add("dot-success")
                    document.getElementById("currentMeeting-name").innerHTML = "Meeting: " + Meetings[meetingIndex].name
                }
                updateParticipantTable()
            }
            else if(eventType === "meeting.id"){
                CurrentMeetingID = data[1]
                document.getElementById("meeting-id-attendance").innerHTML = "ID: " + CurrentMeetingID
                CurrentMeeting = ""
                document.getElementById("status-dot").classList.remove("dot-success")
                document.getElementById("status-dot").classList.add("dot-danger")
                for(i = 0; i < Meetings.length; i++){
                    if(String(Meetings[i].id) === String(CurrentMeetingID)){
                        meetingIndex = i;
                        break
                    }
                }
                if(meetingIndex !== -1){
                    for(let i = 0 ; i < Meetings[meetingIndex].arr.length; i++){
                        let decryptedName = CryptoJS.AES.decrypt(Meetings[meetingIndex].arr[i],auth.currentUser.uid).toString(CryptoJS.enc.Utf8);
                        const name = decryptedName.split(" ")
                        const participantFirst = name[0]
                        const participantLast = name[name.length-1]
                        let currParticipant = new Participant(participantFirst, participantLast, "Absent", true, " ")// blank time joined if participant hasnt joined yet
                        currParticipant.bufferCount = 0
                        Participants.unshift(currParticipant)

                    }
                }
                updateParticipantTable()
            }
            else if(eventType === "participant.joined"){
                var participantFirst = ""
                var participantLast = ""
                if(data.length === 4){
                    participantFirst = data[1]
                }
                else if(data.length > 4){
                    participantFirst = data[1]
                    participantLast = data[data.length-3] // 3rd word from right instead of 2nd due to adding time at end of data
                }
                let participantEmail = data[data.length-2]// same reason as ^^^
                let fullName = participantFirst.trim() + " " + participantLast.trim()
                let now = data[data.length-1] // gets time from data in ISO format
                EncounteredParticipants.add(fullName.trim())
                if(meetingIndex !== -1){
                    let wasPresent = false
                    let didActOnEvent = false
                    let presentParticipantIndex = -1
                    for(var i = 0 ; i < Participants.length; i++){
                        if(Participants[i].firstName.toLowerCase().trim() === participantFirst.toLowerCase().trim() && Participants[i].lastName.toLowerCase().trim() === participantLast.toLowerCase().trim()){
                            if(Participants[i].email && participantEmail === Participants[i].email){
                                wasPresent = true;
                                presentParticipantIndex = i;
                            }
                            if(Participants[i].email && participantEmail === Participants[i].email && Participants[i].state === "Left Meeting"){
                                didActOnEvent = true
                                let currParticipant = new Participant(participantFirst, participantLast, "Present",true, Participants[i].timeJoined)// doesnt change time joined if left meeting
                                Participants.splice(i,1)
                                currParticipant.bufferCount = 1
                                currParticipant.email = participantEmail
                                Participants.unshift(currParticipant)
                                break;
                            }
                        }
                    }
                    if(!wasPresent){
                        let isRegistered = false
                        didActOnEvent = true
                        for(let i = 0; i < Participants.length; i++){
                            if(Participants[i].state === "Absent" && Participants[i].firstName.toLowerCase().trim() === participantFirst.toLowerCase().trim() && Participants[i].lastName.toLowerCase().trim() === participantLast.toLowerCase().trim()){
                                isRegistered = true;
                                Participants.splice(i,1)
                                let currParticipant = new Participant(participantFirst, participantLast, "Present",true, now)// if going from absent --> present, add time joined
                                currParticipant.bufferCount = 1
                                currParticipant.email = participantEmail
                                Participants.unshift(currParticipant)
                                break;
                            }
                        }
                        if(!isRegistered){
                            let currParticipant = new Participant(participantFirst, participantLast, "Not Registered",false, now)// if going from ___ --> not registered, add time joined
                            currParticipant.bufferCount = 1
                            currParticipant.email = participantEmail
                            Participants.unshift(currParticipant)
                        }
                    }
                    if(!didActOnEvent){
                        Participants[presentParticipantIndex].bufferCount += 1
                    }
                }
                else{
                    let wasPresent = false
                    for(let i = 0; i < Participants.length; i++){
                        if(Participants[i].state === "Not Registered" && Participants[i].email === participantEmail && Participants[i].firstName.toLowerCase().trim() === participantFirst.toLowerCase().trim() && Participants[i].lastName.toLowerCase().trim() === participantLast.toLowerCase().trim()){
                            Participants[i].bufferCount += 1
                            wasPresent = true;
                            break;
                        }
                    }
                    if(!wasPresent){
                        let currParticipant = new Participant(participantFirst, participantLast, "Not Registered",false, now) // add time
                        currParticipant.bufferCount = 1
                        currParticipant.email = participantEmail
                        Participants.unshift(currParticipant)
                    }
                }
                updateParticipantTable()
            }
            else if(eventType === "participant.left"){
                var participantFirst = ""
                var participantLast = ""
                if(data.length === 4){
                    participantFirst = data[1]
                }
                else if(data.length > 4){
                    participantFirst = data[1]
                    participantLast = data[data.length-3] // changed length, so need to change this minus
                }
                let participantEmail = data[data.length-2]// changed length, so need to change this minus
                let fullName = participantFirst.trim() + " " + participantLast.trim()
                for(let i = 0 ; i < Participants.length; i++){
                    if(Participants[i].firstName.toLowerCase().trim() === participantFirst.toLowerCase().trim() && Participants[i].lastName.toLowerCase().trim() === participantLast.toLowerCase().trim() && Participants[i].email && Participants[i].email === participantEmail){
                        if(Participants[i].state === "Not Registered"){
                            if(Participants[i].bufferCount === 1){
                                Participants.splice(i,1)
                            }
                            else{
                                Participants[i].bufferCount -= 1
                            }
                            break;
                        }
                        else if(Participants[i].state === "Present"){
                            if(Participants[i].bufferCount === 1){
                                let currParticipant = new Participant(participantFirst, participantLast, "Left Meeting",true, Participants[i].timeJoined) // doesnt add new time if partic goes from left meeting --> present
                                Participants.splice(i,1)
                                currParticipant.bufferCount = 0
                                currParticipant.email = participantEmail
                                Participants.unshift(currParticipant)
                                break;
                            }
                            else{
                                Participants[i].bufferCount -= 1;
                            }
                        }
                    }
                }
                updateParticipantTable()
            }
        }
        document.getElementById("ld-spin").style.display = "none"
        document.getElementById("refresh").disabled = false
        document.getElementById("refresh-cover").classList.remove("running")
    }
    else{
        if(MeetingIsOccurring){
            document.getElementById("status-dot").classList.remove("dot-warning")
            document.getElementById("status-dot").classList.remove("dot-success")
            document.getElementById("status-dot").classList.add("dot-danger")
            document.getElementById("currentMeeting-name").innerHTML = "No Meeting Has Started"
            document.getElementById("meeting-id-attendance").value = ""
            document.getElementById("meeting-id-attendance").hidden = true
            $("#add-on-registered").prop('disabled',true)
            $("#add-on-registered").hide()
            if(meetingIndex === -1){
                $('#add-edit-meeting-modal').modal('show');
                $("#meeting-id-input-field").val(CurrentMeetingID)
                $("#meeting-name-input-field").val(CurrentMeeting)
                $("#delete-meeting-button").prop('disabled', true)
                $("#delete-meeting-button").hide()
                $("#meeting-id-input-field").prop('disabled',true)
                $("#meeting-name-input-field").prop('disabled',true)
                $("#save-meeting-button").innerHTML = "Add Roster"
                const studentInputTable = document.getElementById("student-input-table")
                while (studentInputTable.rows.length !== 0) {
                    studentInputTable.deleteRow(0)
                }
                rosterParticipantCount = 0
                EncounteredParticipants.forEach(participant => {
                    addStudent(participant)
                })
                document.getElementById("meeting-modal-title").innerHTML = "Add Roster"
            }
            else{
                greenNotification("Your meeting has been saved")
            }
            CurrentMeeting = ""
            CurrentMeetingID = ""
            CurrentMessages = []
            meetingIndex = -1
            Participants = []
            MeetingIsOccurring = false
            EncounteredParticipants = new Set()
            document.getElementById("current-participants").innerHTML = ""
            document.getElementById("current-participant-number").innerHTML = ""
            clearTable()
        }
        else{
            document.getElementById("status-dot").classList.remove("dot-warning")
            document.getElementById("status-dot").classList.remove("dot-success")
            document.getElementById("status-dot").classList.add("dot-danger")
            document.getElementById("currentMeeting-name").innerHTML = "No Meeting Has Started"
            document.getElementById("meeting-id-attendance").value = ""
            document.getElementById("meeting-id-attendance").hidden = true
            CurrentMeeting = ""
            CurrentMeetingID = ""
            Participants = []
            meetingIndex = -1
            document.getElementById("current-participants").innerHTML = ""
            document.getElementById("current-participant-number").innerHTML = ""
            CurrentMessages = []
            clearTable()
            document.getElementById("ld-spin").style.display = "none"
            document.getElementById("refresh").disabled = false
            document.getElementById("refresh-cover").classList.remove("running")
            $("#add-on-registered").prop('disabled',true)
            $("#add-on-registered").hide()
        }
    }
}
function clearTable(){
    const participantTable = document.getElementById("participant-table")
    const currentNumRows = participantTable.rows.length
    for(i = 0; i < currentNumRows-1; i++){
        participantTable.deleteRow(1);
    }
}
$("#student-search-input-field").on('keyup', function (e) {
    const participantTable = document.getElementById("participant-table")
    currValue = $("#student-search-input-field").val();
    document.getElementById("all-filter").classList.add("filter-active")
    document.getElementById("present-filter").classList.remove("filter-active")
    document.getElementById("absent-filter").classList.remove("filter-active")
    document.getElementById("not-registered-filter").classList.remove("filter-active")
    document.getElementById("left-meeting-filter").classList.remove("filter-active")
    if (e.key === 'Enter' || e.keyCode === 13) {
        $("#student-search-input-field").blur()
    }

    clearTable()
    listNamesShown = []
    for(let i = Participants.length-1; i >= 0; i--){
        const fullName = Participants[i].firstName + " " + Participants[i].lastName
        if(fullName.toLowerCase().includes(currValue.toLowerCase().trim())){
            var row = participantTable.insertRow(1+findIndexOfRow(i));
            row.style.backgroundColor = "#ffffff"
            row.style.color = "#000000"
            var cell1 = row.insertCell(0)
            var cell2 = row.insertCell(1)
            var cell3 = row.insertCell(2)
            var cell4 = row.insertCell(3)
            if(Participants[i].state === "Not Registered"){
                row.style.backgroundColor = "#b8b8b8"
                cell4.style.color = "#000000"
            }
            else if(Participants[i].state === "Absent"){
                cell4.style.color = "#dd174d"
            }
            else if(Participants[i].state === "Left Meeting"){
                cell4.style.color = "#ddb217"
            }
            else if(Participants[i].state === "Present"){
                cell4.style.color = "#00bc50"
            }
            cell4.innerHTML = Participants[i].state
            cell1.innerHTML = Participants[i].firstName
            cell2.innerHTML = Participants[i].lastName
            cell3.innerHTML = isoToLocalString(Participants[i].timeJoined)
        }
    }

});
function filterClick(clicked_id){
    notRegisteredCount = 0
    $("#student-search-input-field").val("")
    const participantTable = document.getElementById("participant-table")
    document.getElementById(clicked_id).classList.add("filter-active")
    let presentParticipantCount = 0;
    let totalParticipants = 0;
    clearTable()
    listNamesShown = []
    if(clicked_id === "all-filter"){
        document.getElementById("present-filter").classList.remove("filter-active")
        document.getElementById("absent-filter").classList.remove("filter-active")
        document.getElementById("not-registered-filter").classList.remove("filter-active")
        document.getElementById("left-meeting-filter").classList.remove("filter-active")
        for(let i = Participants.length-1; i >= 0; i--){
            var row = participantTable.insertRow(1+ findIndexOfRow(i));
            Participants[i].row = row
            if(Participants[i].state === "Not Registered"){
                notRegisteredCount+=1
                row.style.backgroundColor = "#b8b8b8"
                presentParticipantCount += 1
            }
            else{
                row.style.backgroundColor = "#ffffff"
            }
            row.style.color = "#000000"
            var cell1 = row.insertCell(0)
            var cell2 = row.insertCell(1)
            var cell3 = row.insertCell(2) // cell 3 contains time now
            var cell4 = row.insertCell(3) // changed cell3 to cell4
            cell4.innerHTML = Participants[i].state
            if(Participants[i].state === "Present"){
                cell4.style.color = "#00bc50"
                presentParticipantCount += 1
                totalParticipants += 1
            }
            if(Participants[i].state === "Absent"){
                cell4.style.color = "#dd174d"
                totalParticipants += 1
            }
            if(Participants[i].state === "Left Meeting"){
                cell4.style.color = "#ddb217"
                totalParticipants += 1
            }
            cell1.innerHTML = Participants[i].firstName
            cell2.innerHTML = Participants[i].lastName
            cell3.innerHTML = isoToLocalString(Participants[i].timeJoined)
        }
    }
    else if(clicked_id === "present-filter"){
        document.getElementById("all-filter").classList.remove("filter-active")
        document.getElementById("absent-filter").classList.remove("filter-active")
        document.getElementById("not-registered-filter").classList.remove("filter-active")
        document.getElementById("left-meeting-filter").classList.remove("filter-active")
        for(let i = Participants.length-1; i >= 0; i--){
            if(Participants[i].state === "Present"){
                presentParticipantCount += 1
                var row = participantTable.insertRow(1+ findIndexOfRow(i));
                row.style.backgroundColor = "#ffffff"
                row.style.color = "#000000"
                var cell1 = row.insertCell(0)
                var cell2 = row.insertCell(1)
                var cell3 = row.insertCell(2)// cell 3 contains time now
                var cell4 = row.insertCell(3) // changed cell3 to cell4
                cell4.innerHTML = Participants[i].state
                cell4.style.color = "#00bc50"
                cell1.innerHTML = Participants[i].firstName
                cell2.innerHTML = Participants[i].lastName
                cell3.innerHTML = isoToLocalString(Participants[i].timeJoined)
                totalParticipants += 1
            }
            else if(Participants[i].state === "Not Registered"){
                presentParticipantCount += 1
                notRegisteredCount += 1
            }
            else if(Participants[i].state === "Absent"){
                totalParticipants += 1
            }
            else if(Participants[i].state === "Left Meeting"){
                totalParticipants += 1
            }
        }
    }
    else if(clicked_id === "absent-filter"){
        document.getElementById("all-filter").classList.remove("filter-active")
        document.getElementById("present-filter").classList.remove("filter-active")
        document.getElementById("not-registered-filter").classList.remove("filter-active")
        document.getElementById("left-meeting-filter").classList.remove("filter-active")
        for(let i = Participants.length-1; i >= 0; i--){
            if(Participants[i].state === "Absent"){
                var row = participantTable.insertRow(1+ findIndexOfRow(i));
                row.style.backgroundColor = "#ffffff"
                row.style.color = "#000000"
                var cell1 = row.insertCell(0)
                var cell2 = row.insertCell(1)
                var cell3 = row.insertCell(2)// cell 3 contains time now
                var cell4 = row.insertCell(3) // changed cell3 to cell4
                cell4.innerHTML = Participants[i].state
                cell4.style.color = "#dd174d"
                cell1.innerHTML = Participants[i].firstName
                cell2.innerHTML = Participants[i].lastName
                cell3.innerHTML = ""
                totalParticipants += 1
            }
            else if(Participants[i].state === "Present"){
                presentParticipantCount += 1
                totalParticipants += 1
            }
            else if(Participants[i].state === "Not Registered"){
                notRegisteredCount += 1
                presentParticipantCount += 1
            }
            else if(Participants[i].state === "Left Meeting"){
                totalParticipants += 1
            }
        }
    }
    else if(clicked_id === "not-registered-filter"){
        document.getElementById("all-filter").classList.remove("filter-active")
        document.getElementById("absent-filter").classList.remove("filter-active")
        document.getElementById("present-filter").classList.remove("filter-active")
        document.getElementById("left-meeting-filter").classList.remove("filter-active")
        for(let i = Participants.length-1; i >= 0; i--){
            if(Participants[i].state === "Not Registered"){
                notRegisteredCount += 1
                var row = participantTable.insertRow(1+ findIndexOfRow(i));
                row.style.backgroundColor = "#b8b8b8"
                row.style.color = "#000000"
                var cell1 = row.insertCell(0)
                var cell2 = row.insertCell(1)
                var cell3 = row.insertCell(2)// cell 3 contains time now
                var cell4 = row.insertCell(3) // changed cell3 to cell4
                cell4.innerHTML = Participants[i].state
                cell1.innerHTML = Participants[i].firstName
                cell2.innerHTML = Participants[i].lastName
                cell3.innerHTML = isoToLocalString(Participants[i].timeJoined)
                presentParticipantCount += 1
            }
            else if(Participants[i].state === "Present"){
                presentParticipantCount += 1
                totalParticipants += 1
            }
            else if(Participants[i].state === "Left Meeting"){
                totalParticipants += 1
            }
            else if(Participants[i].state === "Absent"){
                totalParticipants += 1
            }
        }
    }
    else if(clicked_id === "left-meeting-filter"){
        document.getElementById("all-filter").classList.remove("filter-active")
        document.getElementById("absent-filter").classList.remove("filter-active")
        document.getElementById("present-filter").classList.remove("filter-active")
        document.getElementById("not-registered-filter").classList.remove("filter-active")
        for(let i = Participants.length-1; i >= 0; i--){
            if(Participants[i].state === "Left Meeting"){
                var row = participantTable.insertRow(1+ findIndexOfRow(i));
                row.style.backgroundColor = "#ffffff"
                var cell1 = row.insertCell(0)
                var cell2 = row.insertCell(1)
                var cell3 = row.insertCell(2)// cell 3 contains time now
                var cell4 = row.insertCell(3) // changed cell3 to cell4
                cell4.innerHTML = Participants[i].state
                cell4.style.color = "#ddb217"
                cell1.innerHTML = Participants[i].firstName
                cell2.innerHTML = Participants[i].lastName
                cell3.innerHTML = isoToLocalString(Participants[i].timeJoined)
                totalParticipants += 1
            }
            else if(Participants[i].state === "Not Registered"){
                notRegisteredCount += 1
                presentParticipantCount += 1
            }
            else if(Participants[i].state === "Present"){
                presentParticipantCount += 1
                totalParticipants += 1
            }
            else if(Participants[i].state === "Absent"){
                totalParticipants += 1
            }
        }
    }
    if(MeetingIsOccurring && meetingIndex === -1){
        document.getElementById("current-participants").innerHTML = "Participants: "
        document.getElementById("current-participant-number").innerHTML = String(presentParticipantCount)
    }
    else if(MeetingIsOccurring){
        document.getElementById("current-participants").innerHTML = "Participants: "
        document.getElementById("current-participant-number").innerHTML = String(presentParticipantCount) + " out of " + String(totalParticipants)
    }
    else{
        document.getElementById("current-participants").innerHTML = ""
        document.getElementById("current-participant-number").innerHTML = ""
    }
    if(notRegisteredCount > 0){
        if(meetingIndex === - 1){
            document.getElementById("add-on-registered").innerHTML = "Create Roster"
        }
        else{
            document.getElementById("add-on-registered").innerHTML = "Update Roster"
        }
        $("#add-on-registered").prop('disabled',false)
        $("#add-on-registered").show()
    }
    else{
        $("#add-on-registered").prop('disabled',true)
        $("#add-on-registered").hide()
    }
}

function isoToLocalString(ISO){

    var date = new Date(ISO) // converts ISO to date Class
    var local = date.toLocaleTimeString() // converts Date into local time string
    if (local === "Invalid Date"){
        local = ""
    }
    return local
}

function sortByLast(){
    ParticipantTableSortBy = "last"
    var lastButton = document.getElementById("lastNameBtn")
    lastButton.style.color = "#F5B364"
    var firstButton = document.getElementById("firstNameBtn")
    firstButton.style.color = "white"
    var timeButton = document.getElementById("timeJoinedBtn")
    timeButton.style.color = "white"
    updateParticipantTable()
}
function sortByFirst(){
    ParticipantTableSortBy = "first"
    var lastButton = document.getElementById("lastNameBtn")
    lastButton.style.color = "white"
    var firstButton = document.getElementById("firstNameBtn")
    firstButton.style.color = "#F5B364"
    var timeButton = document.getElementById("timeJoinedBtn")
    timeButton.style.color = "white"
    updateParticipantTable()
}

function sortByTime(){
    ParticipantTableSortBy = "time"
    var lastButton = document.getElementById("lastNameBtn")
    lastButton.style.color = "white"
    var firstButton = document.getElementById("firstNameBtn")
    firstButton.style.color = "white"
    var timeButton = document.getElementById("timeJoinedBtn")
    timeButton.style.color = "#F5B364"
    updateParticipantTable()
}

function findIndexOfRow( i){

    let searchFor;
    if(ParticipantTableSortBy === "first"){
        searchFor = Participants[i].firstName
        searchFor = searchFor.toLowerCase()
    }
    else if (ParticipantTableSortBy === "last"){
        searchFor = Participants[i].lastName
        searchFor = searchFor.toLowerCase()
    }
    else if(ParticipantTableSortBy === "time"){
        searchFor = Participants[i].timeJoined
    }
    var low = 0
    var high = listNamesShown.length-1
    var mid;
    while(low<=high){
        mid = Math.floor((low+high)/2)
        var temp = listNamesShown[mid]
        if(temp < searchFor){
            low = mid +1
        }else if (temp > searchFor){
            high = mid-1
        }else if (temp === searchFor){
            listNamesShown.splice(mid,0,searchFor)
            return mid;
        }
    }
    listNamesShown.splice(low,0,searchFor)
    return low;
}

function addMeetingModal(){
    const studentInputTable = document.getElementById("student-input-table")
    $("#delete-meeting-button").prop('disabled',true)
    $("#delete-meeting-button").hide()
    $("#meeting-id-input-field").val("")
    $("#meeting-name-input-field").val("")
    $("#meeting-id-input-field").removeClass("is-invalid")
    $("#meeting-name-input-field").removeClass("is-invalid")
    while(studentInputTable.rows.length !== 0){
        studentInputTable.deleteRow(0)
    }
    rosterParticipantCount = 0
    addStudent()
    document.getElementById("meeting-modal-title").innerHTML = "Add Roster"
}
function addStudent(name){
    rosterParticipantCount += 1
    document.getElementById("roster-participant-count").innerHTML = "Participant Count: " + rosterParticipantCount
    const studentInputTable = document.getElementById("student-input-table")
    var row = studentInputTable.insertRow(studentInputTable.rows.length)
    row.innerHTML = studentTableBlock
    if(name){
        var res = name.split(" ")

        row.cells[0].children[0].value = res[0]
        if(res.length !== 1){
            row.cells[1].children[0].value = res[res.length-1]
        }
       else{
            row.cells[1].children[0].value = ""
        }
    }
    $("input").on("click", function(){
        $(this).removeClass('is-invalid')
    })
    $('.student-name').on('keypress', function(e) {
        if (e.which === 32){
            return false;
        }
    });
    $('.student-name').on('paste', function (event) {
        if (event.originalEvent.clipboardData.getData('Text').match(/[^\w]/)) {
            event.preventDefault();
        }
    });
}
function deleteStudent(e){
    rosterParticipantCount -= 1
    document.getElementById("roster-participant-count").innerHTML = "Participant Count: " + rosterParticipantCount
    const currentRow = e.parentNode.parentNode
    currentRow.parentNode.removeChild(currentRow)
}
function addNotRegistered(){
    $("#meeting-id-input-field").prop('disabled',true)
    $("#meeting-name-input-field").prop('disabled',true)
    if(meetingIndex === -1){
        isEditingMeeting = false
        document.getElementById("meeting-modal-title").innerHTML = "Create Roster"
    }
    else{
        isEditingMeeting = true
        editingIndex = meetingIndex+1
        document.getElementById("meeting-modal-title").innerHTML = "Update Roster"
    }
    const studentInputTable = document.getElementById("student-input-table")
    $("#delete-meeting-button").prop('disabled',true)
    $("#delete-meeting-button").hide()
    $("#meeting-id-input-field").val(CurrentMeetingID)
    $("#meeting-name-input-field").val(CurrentMeeting)
    $("#meeting-id-input-field").removeClass("is-invalid")
    $("#meeting-name-input-field").removeClass("is-invalid")
    while(studentInputTable.rows.length !== 0){
        studentInputTable.deleteRow(0)
    }
    rosterParticipantCount = 0
    for(let i = 0; i < Participants.length; i++){
        const fullName = Participants[i].firstName + " " + Participants[i].lastName
        addStudent(fullName)
    }
}


function compareMeetings(a, b) {
    if (a.name > b.name) return 1;
    if (b.name > a.name) return -1;
    if(a.id > b.id) return 1
    if(a.id < b.id) return -1
    return 0;
}
function comparePastMeetings(a, b) {
    if (a.MeetingStart > b.MeetingEnd) return -1
    return 1;
}



$("#records-search-input-field").on('keyup', function (e) {
    const recordTable = document.getElementById("records-table")
    currValue = $(this).val();
    if (e.key === 'Enter' || e.keyCode === 13) {
        $("#records-search-input-field").blur()
    }
    while(recordTable.rows.length > 1){
        recordTable.deleteRow(1)
    }
    for(let i = PastMeetings.length-1; i >= 0; i--){
        const name = PastMeetings[i].MeetingName
        const currentRecordTable = document.getElementById("current-record-table")
        if(name.toLowerCase().includes(currValue.toLowerCase().trim())){
            var currentRow = recordTable.insertRow(1)
            currentRow.addEventListener("click", function () {
                var index = this.rowIndex
                currentRecordIndex = index-1
                const currentMeeting = PastMeetings[index - 1]
                document.getElementById("current-record-name").innerHTML = "Meeting Name: " + currentMeeting.MeetingName
                document.getElementById("current-record-id").innerHTML = "Meeting ID: " + currentMeeting.MeetingID
                document.getElementById("current-record-date").innerHTML = "Date: " + currentMeeting.MeetingStart.toDate().toLocaleString() + " - " + currentMeeting.MeetingEnd.toDate().toLocaleString()
                $('#meeting-record-modal').modal('show');

                while (currentRecordTable.rows.length !== 0) {
                    currentRecordTable.deleteRow(0)
                }
                for (i = 0; i < currentMeeting.events.length; i++) {
                    var row = currentRecordTable.insertRow(currentRecordTable.rows.length)
                    var cell1 = row.insertCell(0)
                    cell1.innerHTML = currentMeeting.events[i]
                }
            })
            var cell1 = currentRow.insertCell(0)
            var cell2 = currentRow.insertCell(1)
            var cell3 = currentRow.insertCell(2)
            currentRow.style.backgroundColor = "#ffffff"
            cell1.innerHTML = PastMeetings[i].MeetingName
            cell2.innerHTML = PastMeetings[i].MeetingID
            cell3.innerHTML = PastMeetings[i].MeetingStart.toDate().toLocaleString()
            cell2.classList.add("meeting-id-text")
            currentRow.classList.add("record-row")
        }
    }

});
$("#current-record-search-input-field").on('keyup', function (e) {
    const currentRecordTable = document.getElementById("current-record-table")
    currValue = $("#current-record-search-input-field").val();
    if (e.key === 'Enter' || e.keyCode === 13) {
        $("#current-record-search-input-field").blur()
    }

    while(currentRecordTable.rows.length > 0){
        currentRecordTable.deleteRow(0)
    }
    for(let i = PastMeetings[currentRecordIndex].events.length-1; i >= 0; i--){
        const currString = CryptoJS.AES.decrypt(PastMeetings[currentRecordIndex].events[i],auth.currentUser.uid).toString(CryptoJS.enc.Utf8);
        if(currString.toLowerCase().includes(currValue.toLowerCase().trim())){
            var row = currentRecordTable.insertRow(0);
            row.style.backgroundColor = "#ffffff"
            row.style.color = "#000000"
            var cell1 = row.insertCell(0)
            cell1.innerHTML = CryptoJS.AES.decrypt(PastMeetings[currentRecordIndex].events[i],auth.currentUser.uid).toString(CryptoJS.enc.Utf8);

        }
    }

});

function deleteRecord(){
    const currentRecord = PastMeetings[currentRecordIndex]
    firestore.collection("Records").doc(currentRecord.docID).delete().then(() => {
        $("#meeting-record-modal").modal("hide")
        greenNotification("Meeting record deleted")
    }).catch((error) => {
        redNotification("Error deleting record")
    });
}
function confirmDeleteAllRecords(){
    let deletionCount = 0
    let PastMeetingsLength = PastMeetings.length
    let PastMeetingIDs = []
    for(let i = 0; i < PastMeetingsLength; i++){
        PastMeetingIDs.push(PastMeetings[i].docID)
    }
    for(let i = 0; i < PastMeetingsLength; i++){
        if(i < PastMeetingsLength){
            firestore.collection("Records").doc(PastMeetingIDs[i]).delete().then(() =>{
                deletionCount += 1
                if(deletionCount === PastMeetingsLength){
                    $("#delete-record-warning-modal").modal("hide")
                    greenNotification("All meeting records deleted")
                }
            }).catch((error) => {
                redNotification("Error deleting records")
                i = PastMeetingsLength
            })
        }
        else{
            break
        }
    }
    $("#delete-record-warning-modal").modal("hide")
}

function deleteMeeting(){
    const currentMeeting = Meetings[editingIndex-1]
    const uid = auth.currentUser.uid
    const currentId = currentMeeting.id
    const currentName = currentMeeting.name
    const reference = uid+currentId+encodeURIComponent(currentName).replace(/\./g, '%2E')
    firestore.collection("Periods").doc(reference).delete().then(() => {
        greenNotification("Roster deleted")
        $("#add-edit-meeting-modal").modal("hide")
    }).catch((error) => {
        redNotification("Error deleting roster")
    });
}
async function deleteMeetingNoNotification(){
    const currentMeeting = Meetings[editingIndex-1]
    const uid = auth.currentUser.uid
    const currentId = currentMeeting.id
    const currentName = currentMeeting.name
    const reference = uid+currentId+encodeURIComponent(currentName).replace(/\./g, '%2E')
    firestore.collection("Periods").doc(reference).delete().then(() => {
    }).catch((error) => {
    });
}


function check(){
    const idInput = document.getElementById("meeting-id-input-field").value
    const nameInput = document.getElementById("meeting-name-input-field").value

    names = []
    var currentName = ""
    var currentCount = 0
    var shouldProceed = true;
    if(idInput === "" || idInput == null){
        document.getElementById("meeting-id-input-field").classList.add("is-invalid")
        shouldProceed = false;
    }
    else{
        document.getElementById("meeting-id-input-field").classList.remove("is-invalid")
    }
    if(nameInput === "" || idInput == null){
        document.getElementById("meeting-name-input-field").classList.add("is-invalid")
        shouldProceed = false;
    }
    else{
        document.getElementById("meeting-name-input-field").classList.remove("is-invalid")
    }
    $('.student-name').each(function(index,data) {
        const value = $(this).val().trim();
        if(currentCount % 2 === 0){
            currentName += value + " "
        }
        else{
            currentName += value
            names.push(CryptoJS.AES.encrypt(currentName, auth.currentUser.uid).toString())
            currentName = ""
        }
        if((value === "" || value == null) && currentCount % 2 === 0){
            this.classList.add("is-invalid")
            shouldProceed = false;
        }
        else{
            this.classList.remove("is-invalid")
        }
        currentCount += 1
    });
    return shouldProceed
}
function checkID(){
    const currID = document.getElementById("meeting-id-input-field").value
    if(currID.length < 9){
        document.getElementById("meeting-id-input-field").classList.add("is-invalid")
        return false
    }
    document.getElementById("meeting-id-input-field").classList.remove("is-invalid")
    return true
}

function checkDuplicateID(){
    const meetingId = document.getElementById("meeting-id-input-field").value
    if(!isEditingMeeting){
        for(let i = 0; i < Meetings.length; i++){
            if(Meetings[i].id === meetingId){
                document.getElementById("meeting-id-input-field").classList.add("is-invalid")
                return false;
            }
        }
    }
    else{
        for(let i = 0; i < Meetings.length; i++){
            if(Meetings[i].id === meetingId && i !== editingIndex-1){
                document.getElementById("meeting-id-input-field").classList.add("is-invalid")
                return false;
            }
        }
    }
    document.getElementById("meeting-id-input-field").classList.remove("is-invalid")
    return true
}

function addMeeting(){
    const shouldProceed = check()
    if(shouldProceed){
        if(checkID()){
            if(checkDuplicateID()){
                const user = auth.currentUser
                const periodName = document.getElementById("meeting-name-input-field").value
                const meetingId = document.getElementById("meeting-id-input-field").value
                if(isEditingMeeting){
                    deleteMeeting()
                }
                firestore.collection("Periods").doc(user.uid+meetingId+encodeURIComponent(periodName).replace(/\./g, '%2E')).set({
                    useruid : user.uid,
                    periodName : periodName,
                    meetingId : meetingId,
                    studentsNames: names,
                }).then(() => {
                    $("#add-edit-meeting-modal").modal("hide")
                    greenNotification("Rosters Updated")
                }).catch((error)=>{
                    $(".notify").addClass("notify-active");
                    $("#notifyType").addClass("failureServer");
                    setTimeout(function(){
                        $(".notify").removeClass("notify-active");
                        $("#notifyType").removeClass("failureServer");
                    },2000);
                })
            }
            else{
                $(".notify").addClass("notify-active");
                $("#notifyType").addClass("failureIDDup");
                setTimeout(function(){
                    $(".notify").removeClass("notify-active");
                    $("#notifyType").removeClass("failureIDDup");
                },2000);
            }
        }
        else{
            $(".notify").addClass("notify-active");
            $("#notifyType").addClass("failureID");
            setTimeout(function(){
                $(".notify").removeClass("notify-active");
                $("#notifyType").removeClass("failureID");
            },2000);
        }
    }
    else{
        $(".notify").addClass("notify-active");
        $("#notifyType").addClass("failure");
        setTimeout(function(){
            $(".notify").removeClass("notify-active");
            $("#notifyType").removeClass("failure");
        },2000);
    }
}
$('#add-edit-meeting-modal').on('hidden.bs.modal', function () {
    isEditingMeeting = false
    $("#meeting-id-input-field").prop('disabled',false)
    $("#meeting-name-input-field").prop('disabled',false)
})
function logout(){
    auth.signOut().then(r => {
        window.location.href = "/";
    }).catch(err => {redNotification(err.message)});
}
function resetSettingInput(){
    document.getElementById("displayName-input-field").value = ""
    document.getElementById("pass-current-email-input-field").value = ""

}
function saveDisplayName(){
    if(document.getElementById("displayName-input-field").value !== "" && (document.getElementById("displayName-input-field").value.trim()).length < 35){
        auth.currentUser.updateProfile({
            displayName: document.getElementById("displayName-input-field").value.trim()
        }).then(function() {
            firestore.collection("Users").doc(auth.currentUser.uid).set({
                name : document.getElementById("displayName-input-field").value.trim(),
                email : auth.currentUser.email,
            }).then(() => {
                greenNotification("Your name has successfully been changed")
                document.getElementById("user-name").innerHTML = "Welcome " + document.getElementById("displayName-input-field").value
                document.getElementById("displayName-input-field").value = ""
            }).catch((error)=>{
                redNotification(error.message)
            })
        }).catch(function(error) {
            redNotification("Error changing name")
        });
    }
    else if((document.getElementById("displayName-input-field").value.trim()).length >= 35){
        redNotification("Please choose a shorter display name")
    }
    else{
        redNotification("Please make sure you entered in a name")
    }
    $("#settings-modal").modal('hide');
}

function resendVerificationEmail(){
    auth.currentUser.sendEmailVerification().then(function() {
        greenNotification("A verification email has been sent")
        checkVerificationStatus()
    }).catch(function(error) {
        redNotification(error.message)
    });
}
function settingsResendVerificationEmail(){
    auth.currentUser.sendEmailVerification().then(function() {
        $("#settings-modal").modal('hide');
        checkVerificationStatus()
        greenNotification("A verification email has been sent")
    }).catch(function(error) {
        redNotification(error.message)
    });
}
function resetPassword(){
    auth.sendPasswordResetEmail(document.getElementById("pass-current-email-input-field").value.trim()).then(function() {
        document.getElementById("pass-current-email-input-field").value = ""
        greenNotification("A password reset email has been sent")
    }).catch(function(error) {
        redNotification("Incorrect email entered")
    });
    $("#settings-modal").modal('hide');
}
function checkVerificationStatus(){
    clearInterval(checkVerificationTimer)
    checkVerificationTimer = setInterval(() => {
        auth.currentUser.reload().then(load => {
            if(auth.currentUser.emailVerified){
                firestore.collection("Users").doc(auth.currentUser.uid).set({
                    name : auth.currentUser.displayName,
                    email : auth.currentUser.email
                }).then(() => {
                    window.location.href = "dashboard"
                    clearInterval(checkVerificationTimer)
                }).catch((error)=>{
                    redNotification(error.message)
                })
            }
        })
    },1000)
}
function redNotification(message){

    $(".notify").addClass("notify-active-red");
    document.getElementById("notifyType").innerHTML = message

    setTimeout(function(){
        $(".notify").removeClass("notify-active-red");
        document.getElementById("notifyType").innerHTML = ""
    },2000);
}
function greenNotification(message){

    $(".notify").addClass("notify-active-green");
    document.getElementById("notifyType").innerHTML = message

    setTimeout(function(){
        $(".notify").removeClass("notify-active-green");
        document.getElementById("notifyType").innerHTML = ""
    },2000);
}
function yellowNotification(message){
    $(".notify").addClass("notify-active-yellow");
    document.getElementById("notifyType").innerHTML = message

    setTimeout(function(){
        $(".notify").removeClass("notify-active-yellow");
        document.getElementById("notifyType").innerHTML = ""
    },2000);
}
