'use strict';
const drone = new ScaleDrone('OOgX7u3om3pEfCPf');

// Nome da sala deve ser precedido de 'observable-'
const roomName = 'observable-nildopontes';
const configuration = {
   iceServers: [{
      urls: 'stun:stun.l.google.com:19302'
   }]
};
var showLog = false;
var room;
var pc = {};
var stream;
document.addEventListener('DOMContentLoaded', () => {
   if(location.search == '?log'){
      showLog = true;
      log.style.display = 'initial';
   }
   onLog('Documento carregado');
});

navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(s => {
   stream = s;
   document.getElementById('call').removeAttribute('disabled');
});
function initStream(){
   Object.keys(pc).forEach(key => {
      onLog('Stream enviado para ' + key);
      pc[key].addTrack(stream.getTracks()[0]);
      pc[key].createOffer().then(offer => {
         pc[key].setLocalDescription(offer).then(() => {
            onLog('Oferta para ' + key);
            sendMessage({'sdp': pc[key].localDescription}, key);
         });
      }).catch(err => onLog(err));
   });
   let bt = document.getElementById('call');
   bt.style.background = 'red';
   bt.setAttribute('onclick', 'stopStream()');
}

function stopStream(){
   Object.keys(pc).forEach(key => {
      pc[key].close();
      onLog('Encerra chamada com ' + key);
      let element = document.getElementById(key);
      if(element) element.remove();
   });
   let bt = document.getElementById('call');
   bt.style.background = 'green';
   bt.setAttribute('onclick', 'initStream()');
}

function addMember(member){
   onLog(member + ' adicionado');
   let pcn = new RTCPeerConnection(configuration);
   pcn.onicecandidate = event => {
      if(event.candidate){
         onLog('icecandidate para ' + member);
         sendMessage({'candidate': event.candidate}, member);
      }
   };
   pcn.ontrack = event => {
      onLog('Stream de ' + member);
      const stream = new MediaStream([event.track]);
      onLog(event);
      let audio = document.createElement('audio');
      audio.setAttribute('id', member);
      audio.setAttribute('controls', '');
      audio.setAttribute('autoplay', '');
      audio.srcObject = stream;
      document.body.appendChild(audio);
   };
   pc[member] = pcn;
}

function onLog(msg){
   if(!showLog) return;
   log.value += msg + '\n';
}

drone.on('open', error => {
   if(error){
      onLog(error);
      return;
   }
   room = drone.subscribe(roomName);
   room.on('open', error => {
      if(error){
         onLog(error);
      }
   });
   // Evento que dispara somente 1 vez ao entrar na sala. Retorna os membros online
   room.on('members', members => {
      onLog('Entrei na sala com id = ' + drone.clientId);
      if(members.length > 1){
         members.forEach(member => {
            if(member.id != drone.clientId){
               onLog(member.id + ' membro na sala');
               addMember(member.id);
            }
         });
      }
      startWebRTC();
   });
   // Adiciona à lista um usuário que acabou de entrar na sala
   room.on('member_join', member => {
      addMember(member.id);
   });
   // Exclui da lista o usuário que acabou de sair da sala
   room.on('member_leave', member => {
      let element = document.getElementById(member.id);
      if(element) element.remove();
      delete pc[member.id];
      onLog(member.id + ' saiu');
   });
});

// Envia uma mensagem pelo servidor de sinalização para os membros na  sala
function sendMessage(message, destinyId){
   if(destinyId == '') return;
   message.destiny = destinyId;
   onLog('Enviando para ' + message.destiny);
   drone.publish({
      room: roomName,
      message
   });
}
function startWebRTC(){
   onLog('WebRTC iniciado');
   room.on('data', (message, member) => {
      if(message.destiny != drone.clientId) return;
      if(message.sdp){
         onLog('SDP recebido de ' + member.id);
         pc[member.id].setRemoteDescription(message.sdp, () => {
            if(pc[member.id].remoteDescription.type === 'offer'){
               onLog('SDP type is offer');
               pc[member.id].createAnswer().then(answer => pc[member.id].setLocalDescription(answer)).then(() => sendMessage({'sdp': pc[member.id].localDescription}, member.id)).catch(err => onLog(err));
            }
         });
      }else if(message.candidate){
         onLog('Candidate recebido de ' + member.id);
         pc[member.id].addIceCandidate(message.candidate).catch(err => onLog(err));
      }
   });
}
