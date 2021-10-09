import { peerInterface, RTCDataSignal, RTCIceSignal, wsMessageSend } from "./networking";


var RTCconfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export class Peer {
    peerConnection: RTCPeerConnection;
    dataChannel?: RTCDataChannel;
    id: number; // id is the id for the remote
    localId: number; // local id is the id of this peer
    ready: boolean = false; // ready to send p2p messages
    wsSender: (msg: wsMessageSend)=>void;
    onPeerMsg: (message: peerInterface, id: number) => void;
    onPeerReady: (id: number) => void;
    leaveCallback: (id: number) => void;
    // give 5 seconds to allow webrtc to connect
    // after that start forwarding messages through server
    peerTimeout = 3000;
    usingServer = false;

    constructor(id: number, localId: number,
        signaler: (msg: wsMessageSend)=>void,
        onPeerMsg: (message: peerInterface, id: number) => void,
        onNewPeerReady: (id: number) => void,
        onPeerLeave: (id: number) => void,
    ) {
        this.peerConnection = new RTCPeerConnection(RTCconfig);
        this.id = id;
        this.localId = localId;
        this.wsSender = signaler;
        this.onPeerMsg = onPeerMsg;
        this.onPeerReady = onNewPeerReady;
        this.leaveCallback = onPeerLeave;

        setTimeout(()=>{
            if(!this.ready){
                console.log("using passthrough messages")
                this.usingServer = true;
                this.wsSender({
                    type:"passthrough-signal",
                    data:{
                        src:this.localId,
                        dst:this.id,
                        type:"offer"
                    }})
            }
        }, this.peerTimeout)
        // triggered by setting local description
        // create and send ice candidate
        this.peerConnection.onicecandidate = (event) => {
            // onicecandidates keep coming until an empty event is passed
            // console.log(`event given to onicecandidate ${JSON.stringify(event)}`)
            if (event.candidate) {
                // prepare a message to send to peer 2
                let messageData: RTCIceSignal = {
                    src: this.localId,
                    dst: this.id,
                    messageType: 'ice-candidate',
                    candidate: event.candidate
                };

                console.log("ice candidate generated and send")
                this.wsSender({type:"rtc-signal", data: messageData});
            } else {
                // no more candidates to send
                console.log("All ICE candidates sent!")
            }
        }

        // first set callbacks for once data channel is open
        // once data channel is created this is called
        this.peerConnection.ondatachannel = event => {
            this.dataChannel = event.channel;
            console.log("on data channel called")
            this.setDatachannelCallbacks()
        }
    }

    private setDatachannelCallbacks() {
        console.log(`set data channel callbacks ${this.dataChannel}`)
        if (this.dataChannel) { // checks if its not null
            // some data channel handlers for peer 1
            this.dataChannel.onopen = event => {
                console.log("All set! for webrtc");
                this.ready = true;
                this.onPeerReady(this.id);
            }

            this.dataChannel.onclose = event => {
                console.log("P1: Hey, my data channel was closed!");
                this.leaveCallback(this.id);
            }

            this.dataChannel.onmessage = event => {
                // console.log("P1: I just got this message:");
                // console.log(event.data);
                this.onPeerMsg(JSON.parse(event.data), this.id)
            }
        } else {
            console.log("data channel didnt exist to set callbacks")
        }
    }

    public sendObj(data: peerInterface) {
        if (this.ready) {
            if(this.usingServer){
                this.wsSender({
                    type: "passthrough",
                    data:{
                        src: this.localId,
                        dst: this.id,
                        message: data,
                    }
                })
            }else{
                this.dataChannel!.send(JSON.stringify(data));
            }
        } else {
            console.log("tried to send before ready")
            console.log(this)
        }
    }

    public createDataOffer() {
        this.dataChannel = this.peerConnection.createDataChannel("CHANNEL_NAME")
        this.peerConnection.createOffer().then((OfferRTCSessionDescription) => {
            // peer1, the offerer, will set the offer to be its Local Description
            // setting Local Description triggers the peer1connection.onicecandidate event!!
            this.peerConnection!.setLocalDescription(OfferRTCSessionDescription);

            // Prepare a message to send to peer 2
            let message: RTCDataSignal = {
                src: this.localId!,
                dst: this.id,
                messageType: 'data-offer',
                sessionDescription: OfferRTCSessionDescription
            };
            console.log(OfferRTCSessionDescription)

            // send OfferRTCSessionDescription to peer2 via signaling server
            // this.socket.send(JSON.stringify({type:"rtc-signal", signal:message}));
            this.wsSender({
                type:"rtc-signal",
                data: message
            })

            this.setDatachannelCallbacks()
        })
    }

    // handle offer, means someones trying to join us
    public handleDataOffer(message: RTCDataSignal) {
        this.peerConnection.setRemoteDescription(message.sessionDescription);

        // then create the response
        this.peerConnection.createAnswer().then((AnswerRTCSessionDescription) => {
            console.log("created answer")
            // set the localdescription as the answer
            // setting Local Description triggers the peer2connection.onicecandidate event!!
            this.peerConnection.setLocalDescription(AnswerRTCSessionDescription);

            // Prepare a message to send to peer 2
            let answer: RTCDataSignal = {
                src: message.dst,
                dst: message.src,
                messageType: 'data-answer',
                sessionDescription: AnswerRTCSessionDescription,
            };
            this.wsSender({
                type:"rtc-signal",
                data:answer
            });
        })
    }

    // when we recive a data answer just set it as description, onicecandidate will be called soon
    public handleDataAnswer(message: RTCDataSignal) {
        this.peerConnection.setRemoteDescription(message.sessionDescription);
    }


    public handleIceCandidate(message: RTCIceSignal) {
        // get the candidate from the message
        let candidate = new RTCIceCandidate(message.candidate);

        // add the ice candidate to the connection
        // will automatically call onicecandidate again if it dosent work
        this.peerConnection!.addIceCandidate(candidate).then(() => {
            // it worked!
            console.log('Ice Candidate successfully added to peerconnection')
            },
            // it didn't work!
            err => {
                console.log('PR 1: Oh no! We failed to add the candidate');
                console.log("Here's the error:", err);
        });
    }

    public setUsingPassthrough(to = true){
        this.ready = true;
        this.usingServer = true;
        console.log("All set! for ws");
        this.onPeerReady(this.id)
    }
}
