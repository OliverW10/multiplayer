// https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking
// https://raymondgh.github.io/webrtc.html

interface wsInterface{
  type: "get-id" | "give-id" | "list-games" | "change-vis" | "join-game" | "rtc-signal" | "ping";
  data: RTCSignal | number;
}

interface RTCDataSignal{
  src: number;
  dst: number;
  messageType: 'data-offer' | 'data-answer';
  sessionDescription: RTCSessionDescriptionInit;
}
interface RTCIceSignal{
  src: number;
  dst: number;
  messageType: 'ice-candidate';
  candidate: RTCIceCandidate;
}
type RTCSignal = RTCIceSignal | RTCDataSignal;


export class Networking{
  wsServer: string = "ws://localhost:8080"
  socket: WebSocket;
  peerConnection: RTCPeerConnection = new RTCPeerConnection(); // gets overridden, have to set so you can add event listenders on first signal
  dataChannel?: RTCDataChannel;
  id?: number;
  gamesList: Array<number> = [];
  remotes: Array<number> = [];

  constructor(){
    this.socket = new WebSocket(this.wsServer) // websocket is used to communicate with server
    this.socket.onopen = (e) => {
      console.log("server connection opened");
      this.wsSend("get-id"); // request an id
      setInterval(()=>{this.wsSend("ping")}, 2000) // ping server to keep connection alive and server know if client still there
    };

    this.socket.onmessage = (event) => {
      try{
        var msgObj = JSON.parse(event.data); // assumes its json
      }catch{
        console.log("recived non-json from server")
        return;
      }
      if(msgObj.type == "give-id"){
        this.id = msgObj.data;
        console.log(`got id: ${this.id}`)
        this.wsSend("list-games")
      }
      if(msgObj.type == "games-list"){
        this.gamesList = msgObj.data;
        console.log(`got games list: ${this.gamesList}`)
      }
      if(msgObj.type == "pong"){
        // this.socket.send(JSON.stringify({ping: true}))
        // console.log("recived pong")
      }
      if(msgObj.type == "rtc-signal"){
        this.signalHandler(msgObj.data)
      }
    };

    this.socket.onclose = function(event) {
      if (event.wasClean) {
        console.log(`[close] WS Connection closed cleanly, code=${event.code} reason=${event.reason}`);
      } else {
        // e.g. server process killed or network down
        // event.code is usually 1006 in this case
        console.log('[close] WS Connection died');
      }
    };
    this.socket.onerror = function(error) {
      console.log(`websocket error: ${error}`)
      alert(`[WS error] ${error}`);
    };
  }

  // handles any WS messages with type 'rtc-signal'
  signalHandler(signal: RTCSignal){

    // handle offer, means someones trying to join us
    const handleDataOffer = (message:RTCDataSignal)=>{
      console.log("handling data offer")
      this.peerConnection = new RTCPeerConnection()
      this.peerConnection.setRemoteDescription(message.sessionDescription);
      
      // first set callbacks for once data channel is open
      // once data channel is created this is called
      this.peerConnection.ondatachannel = event => {
        console.log("ondatachannel called")
        // create data channel object for 
        this.dataChannel = event.channel;

        // some data channel handlers for peer 1
        this.dataChannel.onopen = event => {
          console.log("16. All set!");
        }
        this.dataChannel.onclose = event => {
          console.log("Hey, my data channel was closed!");
        }

        this.dataChannel.onmessage = event => {
          console.log("P2: I just got this message:");
          console.log(event.data);
          this.onRtcMessage(event.data)
        }
      }

      // then create the response
      this.peerConnection.createAnswer().then((AnswerRTCSessionDescription) => {
        console.log("created answer")
        // set the localdescription as the answer
        // setting Local Description triggers the peer2connection.onicecandidate event!!
        this.peerConnection!.setLocalDescription(AnswerRTCSessionDescription);
    
        // Prepare a message to send to peer 2
        let message: RTCDataSignal = {	src: signal.dst,
          dst: signal.src,
          messageType: 'data-answer',
          sessionDescription: AnswerRTCSessionDescription
        };
        
        // send AnswerRTCSessionDescription to peer1 via signaling server
        this.wsSend("rtc-signal", message)
      });
    }
    
    // when we recive a data answer just set it as description, onicecandidate will be called soon
    const handleDataAnswer = (message: RTCDataSignal)=>{
      console.log("handling data answer")
      this.peerConnection!.setRemoteDescription(message.sessionDescription);
    }

    // handle incoming ice candidate
    const handleIceCandidate = (message: RTCIceSignal)=>{
      console.log("handling ice candidate")
      // get the candidate from the message
      let candidate = new RTCIceCandidate(message.candidate);

      // add the ice candidate to the connection
      this.peerConnection!.addIceCandidate(candidate).then(() =>
        // it worked!
        console.log('    P2 Ice Candidate successfully added to peer1connection'),
        // it didn't work!
        err => {
          console.log('PR 1: Oh no! We failed to add the candidate');
          console.log("Here's the error:", err);
        });
    }

    console.log("handling signal")
    console.log(signal.messageType)
    switch(signal.messageType){
      case "data-offer":
        console.log("it was a data offer")
        handleDataOffer(signal)
        break;
      case "data-answer":
        console.log("it was a data answer")
        handleDataAnswer(signal)
        break;
      case "ice-candidate":
        console.log("it was a ice candidate")
        handleIceCandidate(signal)
    }

    // triggered by setting local description
    // create and send ice candidate
    this.peerConnection!.onicecandidate = (event) => {
      console.log("'making' ice candidate")
      // onicecandidates keep coming until an empty event is passed
      console.log(`event given to onicecandidate ${JSON.stringify(event)}`)
      console.log(`second given to onicecandidate ${JSON.stringify(this)}`)
      if (event.candidate) {
        // prepare a message to send to peer 2
        let message: RTCIceSignal = { src: signal.dst,
          dst: signal.src,
          messageType: 'ice-candidate',
          candidate: event.candidate
        };
        
        console.log("    ICE Candidate generated and handled by P1 and sent to P2 via signaling server")
        // this.socket.send(JSON.stringify({type:"rtc-signal", data:message}));
        this.wsSend("rtc-signal", message);
      } else {
        // no more candidates to send
        console.log("    All Peer 1 ICE candidates sent!")
      }
    }
  }

  // to create a p2p connection to gameId
  joinGame(gameId: number){
    // sends initial RTC message to connect

    if(!this.id){console.log("tried to join a game before getting id");return}
    // this.remoteId = gameId;

    // message from peer 1 to peer 2
    this.peerConnection = new RTCPeerConnection()
    // triggered by setting local description
    this.peerConnection!.onicecandidate = (event) => {
      console.log("'making' ice candidate, ")
      // onicecandidates keep coming until an empty event is passed
      if (event.candidate) {
        // prepare a message to send to peer 2
        let message: RTCIceSignal = { src: this.id!,
          dst: gameId,
          messageType: 'ice-candidate',
          candidate: event.candidate
        };
        
        console.log("    ICE Candidate generated and handled by P1 and sent to P2 via signaling server")
        // this.socket.send(JSON.stringify({type:"rtc-signal", data:message}));
        this.wsSend("rtc-signal", message);
      } else {
        // no more candidates to send
        console.log("    All Peer 1 ICE candidates sent!")
      }
    }
    this.dataChannel = this.peerConnection.createDataChannel("myFirstDataChannel")
    this.peerConnection.createOffer().then((OfferRTCSessionDescription) => {
      // peer1, the offerer, will set the offer to be its Local Description
      // setting Local Description triggers the peer1connection.onicecandidate event!!
      this.peerConnection!.setLocalDescription(OfferRTCSessionDescription);
    
      // Prepare a message to send to peer 2
      let message: RTCDataSignal = {
        src: this.id!,
        dst: gameId,
        messageType: 'data-offer',
        sessionDescription: OfferRTCSessionDescription
      };
      console.log(OfferRTCSessionDescription)
    
      // send OfferRTCSessionDescription to peer2 via signaling server
      // this.socket.send(JSON.stringify({type:"rtc-signal", signal:message}));
      this.wsSend("rtc-signal", message)
    })
    // some data channel handlers for peer 1
    this.dataChannel.onopen = event => {
      console.log("14. Ice candidates from both peers agreed upon; P1 data channel opened");
    }

    this.dataChannel.onclose = event => {
      console.log("P1: Hey, my data channel was closed!");
    }

    this.dataChannel.onmessage = event => {
      console.log("P1: I just got this message:");
      console.log(event.data);
    }
  }

  // send data to server
  wsSend(type: "get-id" | "list-games" | "rtc-signal" | "ping", data?: RTCSignal | number){
    this.socket.send(JSON.stringify({type:type, data:data}))
  }

  // send data to all peers
  rtcSend(){

  }

  // when you recive data from a peer
  onRtcMessage(message: string){

  }
}