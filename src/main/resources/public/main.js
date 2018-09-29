navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

var pc;
var peer;
var globStream;
var remoteStream;
var userName;
var join;
var sock;
var check;

var configuration = {
	'iceServers': [{
		'url': 'stun:stun.example.org'
	}]
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

function connect() {
	console.log('connect');
	var uri = "wss://video-chat-demo-test.herokuapp.com/signal";
	// var uri = "ws://localhost:8080/signal";
	userName = "";

	if (window.location.href.split("?")[1] != null) {
		peer = window.location.href.split("?")[1].split("=")[1];
	} else {
		peer = "";
	}

	sock = new WebSocket(uri);

	sock.onopen = function (e) {
		console.log('open', e);

		sock.send(
			JSON.stringify(
				{
					type: "login",
					data: userName
				}
			)
		);

		check = setInterval(pingPong, 30000);

		streamingButton.style = "display: block";
		connectButton.textContent = "Reconnect";
		connectButton.style = "display: none";

		setConnected(true);
	}

	sock.onclose = function (e) {
		console.log('close', e);
		setConnected(false);
		stopStreaming();
		alert("Disconnected from server. Please reconnect or reload the page to start again.");


		streamingButton.style = "display: none";
		streamingButton.textContent = "Start Streaming"
		generateURLforJoin.style = "display: none";
		connectButton.style = "display: block";

		if (sock != null) {
			sock.close();
			pc.close();
			remoteView.removeAttribute("src");
			selfView.removeAttribute("src");
			clearInterval(check);
		}
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

		} else if (message.type == 'login_successful') {
			userName = message.dest;

			alert(message.data);

		} else if (message.type == 'disconnect') {
			console.log("RECEIVED MESSAGE -> 'DISCONNECT'");
			stopStreaming();
			setConnected(false);

			remoteView.removeAttribute("src");
			selfView.removeAttribute("src");

		} else if (message.type == 'generateUrl') {
			if (joinUrlText.textContent == "") {
				joinUrlText.textContent = message.data;
			}
		}
	}
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
		console.log("stream added");
		remoteView.src = URL.createObjectURL(evt.stream);
		remoteStream = evt.stream;
	};

	pc.oniceconnectionstatechange = function () {
		console.log("IceConnectionState changed");
		if (pc.iceConnectionState == "failed" || pc.iceConnectionState == "disconnected") {
			streamingButtonSwitch();
			console.log("StreamingButtonSwitch worked");

			setConnected(false);

			remoteView.removeAttribute("src");
			selfView.removeAttribute("src");

		} else if (pc.iceConnectionState == "connected") {
			sendOffer.style = "display: none";
			setConnected(true);
		}
	}

	// get a local stream, show it in a self-view and add it to be sent
	navigator.getUserMedia({
		'audio': true,
		'video': true
	}, function (stream) {
		console.log("Getting 'v' & 'a' streams");
		selfView.src = URL.createObjectURL(stream);
		globStream = stream;
		pc.addStream(stream);
		console.log("Streams added to PeerConnection");
	}, logError);


	if (join) {
		console.log("Peer is : " + peer);
		setTimeout(function () {
			console.log("Sending offer to peer");
			offer(peer);
			sendOffer.style = "display: block";
		}, 3000);
	} else {
		generateURLforJoin.style = "display: block";
	}
}

function offer(dest) {
	console.log("Offer method is trying to send offer to '" + dest + "'");
	peer = dest;
	pc.createOffer(localDescCreated, logError);
	console.log("Offer have been created.");
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

	sendMessage(
		{
			type: "disconnect",
			dest: peer,
			data: {
				'sdp': pc.remoteDescription
			}
		}
	);
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

function setConnected(bool) {
	if (bool) {
		connectionStatus.textContent = "Connected";
		connectionStatus.style = "color: green";
	} else {
		connectionStatus.textContent = "Disconnected";
		connectionStatus.style = "color: red";
	}
}

function pingPong() {
	if (sock != null) {
		console.log("Sock isn't null and client sent message to the server");
		sendMessage({
			type: "ping_pong",
			dest: userName
		});
	}
}

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


window.onload = function () {
	console.log("THE PAGE HAS LOADED");
	var domain = "https://video-chat-demo-test.herokuapp.com/";
	// var domain = "http://localhost:8080/";
	var loc = window.location.href;

	if (loc != domain) {
		join = true;
	} else {
		join = false;
	}
};

connectButton.addEventListener("click", function () {
	connect();
});

streamingButton.addEventListener("click", function () {
	streamingButtonSwitch();
});

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


sendOffer.addEventListener("click", function () {
	setTimeout(function () {
		offer(peer);

	}, 1000);
});

