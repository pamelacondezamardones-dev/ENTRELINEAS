import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getFirestore,collection,doc,addDoc,setDoc,getDoc,getDocs,deleteDoc,onSnapshot,query,where,serverTimestamp,runTransaction,updateDoc} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const error=e=>{console.error(e);alert(e?.message||'Ocurrió un error. Revisa tu conexión y los permisos de Firebase.')};
const validConfig=!Object.values(firebaseConfig).some(x=>String(x).includes('REEMPLAZAR'));
let auth,db,user=null,clubId=null,clubs=[],records=[],notes=[],tab='inicio',stopClubs=null,stopRecords=null,stopNotes=null,saveModal=()=>{};
let deferredInstall=null;
const installed=()=>window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
const android=()=>/Android/i.test(navigator.userAgent);
const mac=()=>/Macintosh|Mac OS X/i.test(navigator.userAgent);
const safari=()=>/Safari/i.test(navigator.userAgent)&&!/Chrome|CriOS|Edg|OPR/i.test(navigator.userAgent);
function refreshInstall(){
 const show=!!user&&!installed();
 $('installBanner').classList.toggle('hide',!show);
 $('install').classList.toggle('hide',!show);
 if(show){$('installHelp').textContent=deferredInstall?'Pulsa Instalar para confirmar desde tu navegador.':installInstructions();}
}
function installInstructions(){
 if(android())return 'Si no aparece la instalación automática: abre el menú ⋮ de Chrome y selecciona Instalar aplicación o Agregar a pantalla principal.';
 if(mac()&&safari())return 'En Safari para Mac: menú Archivo → Agregar al Dock (macOS Sonoma 14 o posterior).';
 if(mac())return 'En Chrome: menú ⋮ → Transmitir, guardar y compartir → Instalar página como aplicación. En Edge: menú ⋯ → Aplicaciones → Instalar este sitio como una aplicación.';
 if(/iPhone|iPad|iPod/i.test(navigator.userAgent))return 'En Safari: botón Compartir → Agregar a pantalla de inicio → Agregar.';
 return 'Abre el menú de tu navegador y busca Instalar aplicación o Agregar a pantalla de inicio.';
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;refreshInstall()});
window.addEventListener('appinstalled',()=>{deferredInstall=null;refreshInstall()});
async function requestInstall(){
 if(deferredInstall){const evt=deferredInstall;deferredInstall=null;try{await evt.prompt();await evt.userChoice;}catch(e){console.warn(e)}refreshInstall();return;}
 $('installHelp').textContent=installInstructions();
 alert('Para instalar EntreLíneas:\n\n'+installInstructions());
}
$('install').onclick=requestInstall;
$('installNow').onclick=requestInstall;
if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(console.warn);
function modal(title,fields,cb){$('modalTitle').textContent=title;$('fields').innerHTML=fields;saveModal=cb;$('modal').showModal()}
function field(k,label,type='text',value='',required=true){return `<label class="label" for="f_${k}">${esc(label)}</label>${type==='textarea'?`<textarea id="f_${k}" name="${k}" ${required?'required':''}>${esc(value)}</textarea>`:type==='select'?`<select id="f_${k}" name="${k}">${value}</select>`:`<input id="f_${k}" name="${k}" type="${type}" value="${esc(value)}" ${required?'required':''}>`}`}
$('close').onclick=$('cancel').onclick=()=>$('modal').close();$('modalForm').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;try{await saveModal(Object.fromEntries(new FormData(e.target)));$('modal').close()}catch(e){error(e)}finally{button.disabled=false}};
if(!validConfig){$('setup').classList.remove('hide')}else{
 const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
 $('signin').onclick=()=>signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value).catch(e=>$('authMsg').textContent=e.message);
 $('signup').onclick=()=>createUserWithEmailAndPassword(auth,$('email').value.trim(),$('password').value).catch(e=>$('authMsg').textContent=e.message);
 $('logout').onclick=()=>signOut(auth);
 onAuthStateChanged(auth,u=>{if(stopClubs)stopClubs();if(stopRecords)stopRecords();if(stopNotes)stopNotes();stopClubs=stopRecords=stopNotes=null;user=u;clubs=[];records=[];notes=[];clubId=null;$('auth').classList.toggle('hide',!!u);$('app').classList.toggle('hide',!u);$('logout').classList.toggle('hide',!u);$('who').textContent=u?.email||'';if(u)listenClubs();refreshInstall()});
}
function listenClubs(){stopClubs=onSnapshot(query(collection(db,'clubs'),where('memberIds','array-contains',user.uid)),snap=>{clubs=snap.docs.map(d=>({id:d.id,...d.data()})).filter(c=>!c.deletedAt);if(!clubs.some(c=>c.id===clubId))clubId=clubs[0]?.id||null;listenRecords();render()},error)}
function listenRecords(){if(stopRecords)stopRecords();if(stopNotes)stopNotes();stopRecords=stopNotes=null;records=[];notes=[];if(clubId){stopRecords=onSnapshot(collection(db,'clubs',clubId,'items'),snap=>{records=snap.docs.map(d=>({id:d.id,...d.data()}));render()},error);stopNotes=onSnapshot(collection(db,'clubs',clubId,'privateNotes',user.uid,'entries'),snap=>{notes=snap.docs.map(d=>({id:d.id,...d.data()}));render()},error)}}
const club=()=>clubs.find(c=>c.id===clubId);const list=type=>records.filter(r=>r.type===type);const isAdmin=()=>club()?.ownerId===user?.uid;const itemRef=id=>doc(db,'clubs',clubId,'items',id);
const addItem=(type,data)=>addDoc(collection(db,'clubs',clubId,'items'),{type,...data,createdBy:user.uid,createdAt:serverTimestamp()});
function render(){if(!user)return;$('clubList').innerHTML=clubs.map(c=>`<button class="club ${c.id===clubId?'active':''}" data-action="selectClub" data-id="${esc(c.id)}">📖 ${esc(c.name)}</button>`).join('')||'<p class="muted">Aún no tienes clubes.</p>';const c=club();$('clubTitle').textContent=c?.name||'Crea o únete a un club';$('clubDesc').textContent=c?.description||'';$('invite').classList.toggle('hide',!c);$('members').classList.toggle('hide',!c);$('deleteClub').classList.toggle('hide',!c||!isAdmin());$('tabs').innerHTML=c?[['inicio','🏠 Inicio'],['libros','📚 Biblioteca'],['debate','💬 Debate'],['votos','🗳️ Votaciones'],['reuniones','📅 Reuniones'],['diario','✍️ Mi diario']].map(([id,t])=>`<button class="tab ${tab===id?'active':''}" data-action="tab" data-id="${id}">${t}</button>`).join(''):'';if(!c){$('content').innerHTML='<p class="notice">Crea un club con + o ingresa un código de invitación.</p>';return}
 const books=list('book'),current=books.find(b=>b.status==='actual');let html='';
 if(tab==='inicio'){html=`<div class="grid"><div class="tile"><h3>${books.length}</h3>Libros del club</div><div class="tile"><h3>${books.filter(b=>b.status==='leido').length}</h3>Lecturas terminadas</div><div class="tile"><h3>${(c.memberIds||[]).length}</h3>Integrantes</div></div><h2 style="margin-top:20px">Libro del momento</h2>${current?bookCard(current):'<p class="notice">Todavía no hay libro actual.</p>'}${current?`<div class="tile" style="margin-top:12px"><label class="label">Mi progreso: <span id="progressValue">${progress(current.id)}%</span></label><input type="range" min="0" max="100" step="5" value="${progress(current.id)}" data-progress="${esc(current.id)}"><div class="progress"><div style="width:${progress(current.id)}%"></div></div></div>`:''}`}
 if(tab==='libros')html=`<div class="between"><h2>Biblioteca</h2><button data-action="addBook">+ Agregar libro</button></div><div class="grid">${books.map(bookCard).join('')}</div>`;
 if(tab==='debate'){const posts=list('post').sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));const comments=list('comment');html=`<div class="between"><h2>Debates</h2><button data-action="addPost">+ Abrir nuevo debate</button></div><p class="notice">Todos los integrantes pueden participar varias veces en cada debate. Los spoilers se mantienen ocultos hasta abrirlos.</p>${posts.map(p=>{const replies=comments.filter(x=>x.postId===p.id).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));return `<div class="tile" style="margin:12px 0"><strong>${esc(p.author||'Integrante')}</strong><h3>${esc(p.title)}</h3>${p.spoiler?`<details><summary>⚠ Ver spoiler</summary><p>${esc(p.text)}</p></details>`:`<p>${esc(p.text)}</p>`}<p class="muted">${replies.length} comentario(s)</p>${replies.map(r=>`<div style="background:#f7f3ff;border-radius:12px;padding:10px;margin:8px 0"><strong>${esc(r.author||'Integrante')}</strong> <span class="muted">${r.createdAt?.toDate?.().toLocaleString('es-CL')||''}</span>${r.spoiler?`<details><summary>⚠ Comentario con spoiler</summary><p>${esc(r.text)}</p></details>`:`<p>${esc(r.text)}</p>`}${deleteButton(r)}</div>`).join('')}<button data-action="comment" data-id="${esc(p.id)}">💬 Agregar comentario</button> ${deleteButton(p)}</div>`}).join('')}`}
 if(tab==='votos'){const proposals=list('proposal'),votes=list('vote');html=`<div class="between"><h2>Próxima lectura</h2><button data-action="addProposal">+ Proponer</button></div>${proposals.map(p=>{const pv=votes.filter(v=>v.proposalId===p.id),yes=pv.filter(v=>v.choice==='si').length,no=pv.filter(v=>v.choice==='no').length,total=yes+no,mine=pv.find(v=>v.createdBy===user.uid)?.choice;return `<div class="tile" style="margin:12px 0"><h3>${esc(p.title)}</h3><p>${esc(p.author)}</p><p>👍 Sí: <strong>${yes}</strong> · 👎 No: <strong>${no}</strong> · Total: ${total}</p><div class="progress"><div style="width:${total?100*yes/total:0}%;background:#25a876"></div></div><p class="muted">${total?Math.round(100*yes/total):0}% a favor ${mine?'· Tu voto: '+(mine==='si'?'Sí':'No'):'· Aún no has votado'}</p><div class="flex"><button data-action="vote" data-choice="si" data-id="${esc(p.id)}" ${mine==='si'?'disabled':''}>👍 Votar Sí</button><button class="alt" data-action="vote" data-choice="no" data-id="${esc(p.id)}" ${mine==='no'?'disabled':''}>👎 Votar No</button>${deleteButton(p)}</div></div>`}).join('')}`}
 if(tab==='reuniones')html=`<div class="between"><h2>Reuniones</h2><button data-action="addMeeting">+ Agendar</button></div>${list('meeting').sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(m=>`<div class="tile" style="margin:12px 0"><h3>${esc(m.title)}</h3><p>📅 ${esc(m.date)} ${esc(m.time||'')} · 📍 ${esc(m.place||'')}</p><p>${esc(m.details||'')}</p>${deleteButton(m)}</div>`).join('')}`;
 if(tab==='diario')html=`<div class="between"><h2>Mi diario privado</h2><button data-action="addNote">+ Reflexión</button></div>${notes.map(n=>`<div class="tile" style="margin:12px 0"><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p>${deleteButton(n)}</div>`).join('')}`;
 $('content').innerHTML=html||'<p class="muted">No hay registros todavía. ¡Agrega el primero!</p>';
}
function progress(id){return Math.min(100,Math.max(0,Number(list('progress').find(x=>x.bookId===id&&x.createdBy===user.uid)?.value)||0))}
function bookCard(b){return `<div class="tile book"><div class="cover">${b.cover&&/^https:\/\//.test(b.cover)?`<img src="${esc(b.cover)}" alt="Portada" loading="lazy">`:'📖'}</div><div><h3>${esc(b.title)}</h3><div class="muted">${esc(b.author)}</div><p>${esc(b.synopsis||'')}</p><span class="pill">${esc(b.status||'pendiente')}</span> ${deleteButton(b)}</div></div>`}
function deleteButton(r){return r.createdBy===user?.uid||isAdmin()?`<button class="danger" data-action="delete" data-id="${esc(r.id)}">Eliminar</button>`:''}
$('newClub').onclick=()=>modal('Crear club',field('name','Nombre')+field('description','Descripción','textarea','',false),async v=>{const ref=doc(collection(db,'clubs'));await setDoc(ref,{name:v.name,description:v.description,ownerId:user.uid,memberIds:[user.uid],createdAt:serverTimestamp()});clubId=ref.id;tab='inicio'});
$('deleteClub').onclick=async()=>{
 const c=club();if(!c||!isAdmin())return;
 if(!confirm(`PRIMERA CONFIRMACIÓN\n\n¿Quieres eliminar el club «${c.name}»? Desaparecerá para todos los integrantes y dejará de admitir nuevas operaciones.`))return;
 const typed=prompt(`SEGUNDA CONFIRMACIÓN\n\nEscribe exactamente el nombre del club para confirmar:\n${c.name}`);
 if(typed===null)return;
 if(typed.trim()!==c.name.trim()){alert('El nombre no coincide. No se realizó ningún cambio.');return;}
 try{await updateDoc(doc(db,'clubs',c.id),{deletedAt:serverTimestamp(),deletedBy:user.uid});
  alert('Club retirado de la aplicación para todos sus integrantes. Sus registros quedan conservados en Firestore hasta realizar una eliminación definitiva desde un entorno administrador.');
 }catch(e){error(e)}
};
$('join').onclick=async()=>{const id=$('joinCode').value.trim();if(!/^[A-Za-z0-9]{12,80}$/.test(id))return alert('Código no válido');try{await setDoc(doc(db,'clubs',id,'joinRequests',user.uid),{uid:user.uid,email:user.email||'',createdAt:serverTimestamp()});$('joinCode').value='';alert('Solicitud enviada. Debe aprobarla el administrador del club.')}catch(e){error(e)}};
$('invite').onclick=()=>{const id=clubId;modal('Invitar integrantes',`<p>Comparte este código con las personas que quieras invitar. Quien lo tenga podrá unirse al club.</p><input readonly value="${esc(id)}" onclick="this.select()">`,async()=>{})};
$('members').onclick=async()=>{const c=club();if(!c)return;let html=`<p>${c.memberIds.length} integrante(s)</p>${c.memberIds.map(x=>`<p class="muted">${esc(x)} ${x===c.ownerId?'(administrador)':''}</p>`).join('')}`;if(isAdmin()){const snap=await getDocs(collection(db,'clubs',clubId,'joinRequests'));html+='<h3>Solicitudes pendientes</h3>'+ (snap.empty?'<p>No hay solicitudes.</p>':snap.docs.map(d=>`<p>${esc(d.data().email||d.id)} <button type="button" data-approve="${esc(d.id)}">Aprobar</button></p>`).join(''));}modal('Integrantes',html,async()=>{});};
$('fields').addEventListener('click',async e=>{const b=e.target.closest('[data-approve]');if(!b)return;const uid=b.dataset.approve;try{await runTransaction(db,async t=>{const cref=doc(db,'clubs',clubId),rref=doc(db,'clubs',clubId,'joinRequests',uid);const c=await t.get(cref),r=await t.get(rref);if(!c.exists()||!r.exists()||c.data().ownerId!==user.uid)throw Error('No autorizado');const members=c.data().memberIds||[];if(!members.includes(uid)){if(members.length>=100)throw Error('Club completo');t.update(cref,{memberIds:[...members,uid]})}t.delete(rref)});$('modal').close();alert('Integrante aprobado.')}catch(e){error(e)}});
$('content').addEventListener('change',async e=>{const id=e.target.dataset.progress;if(!id)return;try{await setDoc(doc(db,'clubs',clubId,'items','progress_'+user.uid+'_'+id),{type:'progress',bookId:id,value:Number(e.target.value),createdBy:user.uid,createdAt:serverTimestamp()})}catch(e){error(e)}});
document.addEventListener('click',async e=>{const el=e.target.closest('[data-action]');if(!el)return;const a=el.dataset.action,id=el.dataset.id;if(a==='selectClub'){clubId=id;tab='inicio';listenRecords();render();return}if(a==='tab'){tab=id;render();return}try{
if(a==='addBook')modal('Agregar libro',field('title','Título')+field('author','Autor/a')+field('synopsis','Reseña','textarea','',false)+field('cover','URL de portada HTTPS','url','',false)+field('status','Estado','select','<option value="pendiente">Pendiente</option><option value="actual">Lectura actual</option><option value="leido">Leído</option>'),async v=>{if(v.status==='actual'){for(const b of list('book').filter(x=>x.status==='actual'))await setDoc(itemRef(b.id),{status:'pendiente'},{merge:true})}await addItem('book',v)});
if(a==='addPost')modal('Abrir nuevo debate',field('title','Tema')+field('text','Comentario','textarea')+field('spoiler','¿Spoiler?','select','<option value="no">No</option><option value="si">Sí</option>'),async v=>addItem('post',{title:v.title,text:v.text,spoiler:v.spoiler==='si',author:user.email}));
if(a==='comment'){const post=list('post').find(p=>p.id===id);if(!post)throw Error('Debate no disponible');modal('Comentar: '+post.title,field('text','Tu comentario','textarea')+field('spoiler','¿Contiene spoiler?','select','<option value="no">No</option><option value="si">Sí</option>'),async v=>{if(!v.text.trim())throw Error('Escribe un comentario');await addItem('comment',{postId:id,text:v.text.trim(),spoiler:v.spoiler==='si',author:user.email||'Integrante'})})}
if(a==='addProposal')modal('Proponer libro',field('title','Título')+field('author','Autor/a'),async v=>addItem('proposal',v));
if(a==='addMeeting')modal('Agendar encuentro',field('title','Nombre')+field('date','Fecha','date')+field('time','Hora','time','',false)+field('place','Lugar o enlace','text','',false)+field('details','Detalles','textarea','',false),async v=>addItem('meeting',v));
if(a==='addNote')modal('Mi reflexión privada',field('title','Título')+field('text','Reflexión','textarea'),async v=>addDoc(collection(db,'clubs',clubId,'privateNotes',user.uid,'entries'),{...v,createdAt:serverTimestamp()}));
if(a==='vote'){const choice=el.dataset.choice;if(!['si','no'].includes(choice)||!list('proposal').some(p=>p.id===id))throw Error('Voto no válido');const ref=doc(db,'clubs',clubId,'items','vote_'+user.uid+'_'+id);await setDoc(ref,{type:'vote',proposalId:id,choice,createdBy:user.uid,createdAt:serverTimestamp()})}
if(a==='delete'&&confirm('¿Eliminar este registro?'))await deleteDoc(tab==='diario'?doc(db,'clubs',clubId,'privateNotes',user.uid,'entries',id):itemRef(id));
}catch(err){error(err)}});
