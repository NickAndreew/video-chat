navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

var pc;
var peer;
var globStream;
var remoteStream;
var userName;

// if user is host => join == false, else => join == true
var join;

var loggedIn = false;
var configuration = {
	'iceServers': [{
		'url': 'stun:stun.example.org'
	}]
};

window.onload = function () {
	console.log("THE PAGE HAS LOADED");
	var loc = window.location.href.split("com")[1];

	var text = chnameText.textContent;
	if(loc != "" && loc != null && loc != 'undefined'){
		chnameText.textContent = text + " with User : " + loc.split("=")[1];
		join = true;
	} else {
		join = false;
	}
};

function goBack() {
	window.history.back();
}

function setConnected(val) {
	loggedIn = val;
}

function logError(error) {
	console.log(error.name + ': ' + error.message);
}

function connect(username) {
	console.log('connect');
	// var loc = window.location;
	// var uri = "ws://" + loc.hostname + ":8080/signal";
	var uri = "wss://video-chat-demo-test.herokuapp.com/signal";

	userName = username;
	if (window.location.href.split("com")[1]!=null) {
	    peer = window.location.href.split("com")[1].split("=")[1];
    } else {
        peer = "";
    }


	if (username != peer) {

		sock = new WebSocket(uri);

		sock.onopen = function (e) {
			console.log('open', e);

			sock.send(
				JSON.stringify(
					{
						type: "login",
						data: username
					}
				)
			);

			streamingButton.style = "display: block";
			connectButton.textContent = "Rename";
			loggedIn = true;


		}

		sock.onclose = function (e) {
			console.log('close', e);
			if (sock != null) {
				sock.close();
				pc.close();
			}
			// setConnected(false);

			remoteView.removeAttribute("src");
			selfView.removeAttribute("src");
		}

		sock.onerror = function (e) {
			console.log('error', e);
		}

		sock.onmessage = function (e) {
			console.log('message', e.data);

			var message = JSON.parse(e.data);
			if (message.type === 'rtc') {
				if (message.data.sdp) {
					pc.setRemoteDescription(
						new RTCSessionDescription(message.data.sdp),
						function () {
							// if we received an offer, we need to answer
							if (pc.remoteDescription.type == 'offer') {
								if (!pc) {
									startRTC();
								}
								peer = message.dest;
								pc.createAnswer(localDescCreated, logError);
								generateURLforJoin.style = "display: none";
								sendOffer.style = "display: none";
							}
						},
						logError);
				} else {
					pc.addIceCandidate(new RTCIceCandidate(message.data.candidate));
				}

			} else if (message.type == 'exception') {
				nameIsBusy(message.data);

				// disconnect();
			} else if (message.type == 'disconnect') {
				console.log("RECEIVED MESSAGE -> 'DISCONNECT'");
				stopStreaming();
			} else if (message.type == 'generateUrl') {
				if (joinUrlText.textContent == "") {
					joinUrlText.textContent = message.data;
				}
			}
		}
	} else {
		alert("Please choose a different name.");
	}
	// setConnected(true);
}

function startRTC() {
	pc = new webkitRTCPeerConnection(configuration);

	// send any ice candidates to the other peer
	pc.onicecandidate = function (evt) {
		if (evt.candidate) {
			sendMessage(
				{
					type: "rtc",
					dest: peer,
					data: {
						'candidate': evt.candidate
					}
				}
			);
		}
	};

	// once remote stream arrives, sho480w it in the remote video element
	pc.onaddstream = function (evt) {
		remoteView.src = URL.createObjectURL(evt.stream);
		remoteStream = evt.stream;
	};

	pc.oniceconnectionstatechange = function () {
		if(pc.iceConnectionState=="failed" || pc.iceConnectionState=="disconnected"){
			streamingButtonSwitch();
			if(join){
				sendOffer.style = "display: block";
			} 
		} else if(pc.iceConnectionState=="connected"){
			sendOffer.style = "display: none"; 
		}
	}

	// get a local stream, show it in a self-view and add it to be sent
	navigator.getUserMedia({
		'audio': true,
		'video': true
	}, function (stream) {
		selfView.src = URL.createObjectURL(stream);
		globStream = stream;
		pc.addStream(stream);
	}, logError);

	
	if(peer!=null && peer!=""){
		setTimeout(function(){ 
			offer(peer);
			sendOffer.style = "display: block"; 
		}, 2000);
	} else {
		generateURLforJoin.style = "display: block";
	}
}

function offer(dest) {
	console.log("Offer is sent to " + dest);
	peer = dest;
	pc.createOffer(localDescCreated, logError);
}

function localDescCreated(desc) {
	pc.setLocalDescription(desc, function () {
		// {type: offer, dest: B, data: desc}
		sendMessage(
			{
				type: "rtc",
				dest: peer,
				data: {
					'sdp': pc.localDescription
				}
			}
		);
	}, logError);
};

function sendMessage(payload) {
	sock.send(JSON.stringify(payload));
}

function disconnect() {
	console.log('disconnect');

	// console.log('sending disconnect message to server...');
	sendMessage(
		{
			type: "disconnect",
			dest: peer,
			data: {
				'sdp': pc.remoteDescription
			}
		}
	);

	// setConnected(false);
}

function stopStreaming() {
	console.log(globStream);
	if (globStream != null) {

		globStream.getTracks()
			.forEach(
				track => track.stop()
			);

	}

	if (remoteStream != null) {

		remoteStream.getTracks()
			.forEach(
				track => track.stop()
			);

	}

	remoteView.pause();
	remoteView.removeAttribute('src'); // empty source
	remoteView.load();

	selfView.pause();
	selfView.removeAttribute('src'); // empty source
	selfView.load();

	joinUrlText.textContent = "";
}

function nameIsBusy(e) {
	alert(e);
	document.getElementById("chname").value = '';
}


connectButton.addEventListener("click", function () {
	var input = chname.value;

	if (input != "") {
		connect(input.toString());
	} else {
		alert("Please type name.")
	}
});

streamingButton.addEventListener("click", function () {
	streamingButtonSwitch();
});

function streamingButtonSwitch() {
	if (streamingButton.textContent == "Stop Streaming") {
		disconnect();

		streamingButton.textContent = "Start Streaming";
		streamingButton.style = "display: none";
		generateURLforJoin.style = "display: none";
		connectButton.textContent = "Connect";
		connectButton.style = "display: block";

	} else {

		startRTC();

		streamingButton.textContent = "Stop Streaming";
		connectButton.style = "display: none";
		
	}
}

generateURLforJoin.addEventListener("click", function () {
	if (joinUrlText.textContent == "") {
		sendMessage(
			{
				type: 'generateURL',
				dest: userName,
			}
		);
	} else {
		joinUrlText.textContent = "";
	}
});



sendOffer.addEventListener("click", function (){
	streamingButtonSwitch();
	setTimeout(function(){
		offer(peer);

	}, 1000);

});