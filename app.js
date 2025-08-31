// App SPA — Firebase (CDN), hash-routing e telas básicas
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, query, where, orderBy,
  serverTimestamp, updateDoc, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { APP_NAME, firebaseConfig } from "./config.js";

// --- Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Áreas (estático simples; pode virar coleção 'areas' no futuro) ---
const AREAS = [
  { id: "salon", name: "Salão de Festas" }
];

// --- UI helpers ---
const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, children = []) => {
  const n = Object.assign(document.createElement(tag), attrs);
  children.forEach(c => n.append(c));
  return n;
};
function showToast(msg){ const t=$("#toast"); t.textContent=msg; t.hidden=false; setTimeout(()=>t.hidden=true, 3500); }
function showErr(msg){ const e=$("#errbox"); e.textContent=msg; e.hidden=false; setTimeout(()=>e.hidden=true, 5000); }

// --- Router ---
const routes = {
  "#/login": renderLogin,
  "#/agenda": renderAgenda,
  "#/reservar": renderReservar,
  "#/minhas": renderMinhas,
  "#/privacidade": renderPrivacidade,
  "#/termos": renderTermos
};

function setNavByAuth(user){
  document.title = APP_NAME || document.title;
  const authed = !!user;
  document.querySelectorAll("[data-auth='true']").forEach(n => n.hidden = !authed);
  $("#logoutBtn").hidden = !authed;
}

async function navigate(){
  const path = location.hash || "#/login";
  const user = auth.currentUser;
  setNavByAuth(user);

  const needsAuth = (path !== "#/login");
  if(needsAuth && !user){ location.replace("#/login"); return; }

  const view = routes[path] || renderLogin;
  try {
    await view();
    $("#view")?.focus();
  } catch(err){
    console.error(err);
    showErr(err.message || "Erro ao navegar");
  }
}

window.addEventListener("hashchange", navigate);
onAuthStateChanged(auth, navigate);

// --- Telas ---
async function renderLogin(){
  const main = $("#view");
  main.innerHTML = "";
  const card = el("div", { className:"card grid", role:"region", "aria-label":"Login" }, [
    el("h1", { textContent: "Entrar" }),
    el("p", { className:"help", innerHTML: "Use seu e-mail e senha. <br/> Não usamos SMS." }),
    el("label", { htmlFor:"email", textContent:"E-mail" }),
    el("input", { id:"email", type:"email", placeholder:"voce@exemplo.com", required:true }),
    el("label", { htmlFor:"senha", textContent:"Senha" }),
    el("input", { id:"senha", type:"password", placeholder:"••••••••", required:true }),
    el("div", { className:"row" }, [
      el("button", { className:"btn", textContent:"Entrar", id:"loginBtn" })
    ])
  ]);
  main.append(card);

  $("#loginBtn").onclick = async () => {
    const email = $("#email").value.trim();
    const pass = $("#senha").value;
    if(!email || !pass){ showErr("Informe e-mail e senha."); return; }
    try{
      await signInWithEmailAndPassword(auth, email, pass);
      location.hash = "#/agenda";
    }catch(err){
      showErr(err.message);
    }
  };

  $("#logoutBtn").onclick = async () => { await signOut(auth); location.hash="#/login"; };
}

async function renderAgenda(){
  const main = $("#view"); main.innerHTML="";
  const state = { areaId: AREAS[0].id, date: today() };

  const header = el("div", { className:"card grid"}, [
    el("h1", { textContent:"Agenda" }),
    el("div", { className:"grid grid-3" }, [
      fieldSelect("Área", "area", AREAS, (v)=>{ state.areaId=v; loadList(); }),
      fieldInput("Data", "date", "date", state.date, (v)=>{ state.date=v; loadList(); }),
      el("div", {}, [ el("a", { href:"#/reservar", className:"btn", textContent:"Nova reserva" }) ])
    ])
  ]);

  const listCard = el("div", { className:"card" });
  listCard.append(el("h2", { textContent:"Reservas do dia" }));
  const table = el("table", { className:"table", id:"agendaTable" });
  table.innerHTML = `<thead><tr><th>Início</th><th>Fim</th><th>Apto</th><th>Resp.</th><th>Status</th></tr></thead><tbody></tbody>`;
  listCard.append(table);

  main.append(header, listCard);

  async function loadList(){
    try{
      const qs = query(
        collection(db,"parties"),
        where("areaId","==", state.areaId),
        where("date","==", state.date),
        orderBy("start","asc")
      );
      const snap = await getDocs(qs);
      const tbody = table.querySelector("tbody");
      tbody.innerHTML = "";
      snap.forEach(docu=>{
        const d = docu.data();
        const tr = el("tr");
        tr.append(
          el("td",{textContent:d.start}),
          el("td",{textContent:d.end}),
          el("td",{textContent:d.apto||"-"}),
          el("td",{textContent:d.responsavel||"-"}),
          el("td",{innerHTML: badgeStatus(d.status) })
        );
        tbody.append(tr);
      });
      if(!tbody.childElementCount){
        const tr = el("tr");
        const td = el("td",{ colSpan:5, className:"help", textContent:"Sem reservas para os filtros selecionados."});
        tr.append(td); tbody.append(tr);
      }
    }catch(err){ showErr(err.message); }
  }
  await loadList();

  $("#logoutBtn").onclick = async () => { await signOut(auth); location.hash="#/login"; };
}

async function renderReservar(){
  const main = $("#view"); main.innerHTML="";
  const user = auth.currentUser;
  const state = { areaId: AREAS[0].id, date: today(), start:"14:00", end:"18:00" };

  const card = el("div", { className:"card grid" }, [
    el("h1", { textContent:"Nova Reserva" }),
    el("div", { className:"grid grid-3" }, [
      fieldSelect("Área", "area", AREAS, (v)=>{ state.areaId=v; }),
      fieldInput("Data", "date", "date", state.date, (v)=>{ state.date=v; }),
      el("div", { className:"row" }, [
        fieldInput("Início", "start", "time", state.start, (v)=>{ state.start=v; }),
        fieldInput("Fim", "end", "time", state.end, (v)=>{ state.end=v; })
      ])
    ]),
    el("div", { className:"grid grid-2" }, [
      fieldInput("Apto", "apto", "text", "", ()=>{}),
      fieldInput("Responsável", "responsavel", "text", user?.displayName||"", ()=>{})
    ]),
    fieldInput("Contato", "contato", "text", "", ()=>{}),
    fieldTextarea("Observações", "obs"),
    el("label", { className:"row" }, [
      el("input", { id:"agree", type:"checkbox" }),
      el("span", { textContent:"Li e aceito as regras da área." })
    ]),
    el("div", { className:"row" }, [
      el("button", { className:"btn ghost", textContent:"Validar conflito", id:"btnCheck" }),
      el("button", { className:"btn", textContent:"Salvar", id:"btnSave" })
    ])
  ]);
  main.append(card);

  $("#btnCheck").onclick = async () => {
    try{
      const conflict = await hasConflict(state.areaId, state.date, $("#start").value, $("#end").value);
      if(conflict.length){
        showErr("Conflito: horário já reservado.");
      } else {
        showToast("Sem conflitos para esse intervalo.");
      }
    }catch(err){ showErr(err.message); }
  };

  $("#btnSave").onclick = async () => {
    try{
      if(!$("#agree").checked){ showErr("É preciso aceitar as regras da área."); return; }
      const payload = {
        areaId: $("#area").value,
        areaName: AREAS.find(a=>a.id===$("#area").value)?.name || "",
        date: $("#date").value,
        start: $("#start").value,
        end: $("#end").value,
        apto: $("#apto").value.trim(),
        responsavel: $("#responsavel").value.trim(),
        contato: $("#contato").value.trim(),
        obs: $("#obs").value.trim(),
        status: "ativo",
        created_by: auth.currentUser?.uid || "anon",
        created_at: serverTimestamp()
      };
      const conflicts = await hasConflict(payload.areaId, payload.date, payload.start, payload.end);
      if(conflicts.length){ showErr("Conflito: já existe reserva nesse intervalo."); return; }

      await addDoc(collection(db,"parties"), payload);
      showToast("Reserva criada com sucesso.");
      location.hash = "#/agenda";
    }catch(err){ showErr(err.message); }
  };

  $("#logoutBtn").onclick = async () => { await signOut(auth); location.hash="#/login"; };
}

async function renderMinhas(){
  const main = $("#view"); main.innerHTML="";
  const user = auth.currentUser;

  const card = el("div", { className:"card" }, [
    el("h1", { textContent:"Minhas Reservas" }),
    el("table", { className:"table", id:"myTable" })
  ]);
  main.append(card);

  const table = $("#myTable");
  table.innerHTML = `<thead><tr><th>Data</th><th>Início</th><th>Fim</th><th>Área</th><th>Status</th><th class="mono">Ações</th></tr></thead><tbody></tbody>`;

  try{
    const qs = query(
      collection(db,"parties"),
      where("created_by","==", user.uid),
      orderBy("date","asc"), orderBy("start","asc")
    );
    const snap = await getDocs(qs);
    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";

    snap.forEach(dref=>{
      const d = dref.data();
      const tr = el("tr");
      tr.append(
        el("td",{textContent:d.date}),
        el("td",{textContent:d.start}),
        el("td",{textContent:d.end}),
        el("td",{textContent:d.areaName||"-"}),
        el("td",{innerHTML: badgeStatus(d.status)})
      );
      const actions = el("td");
      const btnCancel = el("button",{className:"btn warn", textContent:"Cancelar"});
      const btnDelete = el("button",{className:"btn err", textContent:"Excluir"});
      actions.append(btnCancel, el("span",{textContent:" "}), btnDelete);
      tr.append(actions);
      tbody.append(tr);

      btnCancel.onclick = async ()=>{
        try{
          await updateDoc(doc(db,"parties", dref.id), { status:"cancelado" });
          showToast("Reserva cancelada."); navigate();
        }catch(err){ showErr(err.message); }
      };
      btnDelete.onclick = async ()=>{
        try{
          await deleteDoc(doc(db,"parties", dref.id));
          showToast("Reserva excluída."); navigate();
        }catch(err){ showErr(err.message); }
      };
    });

    if(!tbody.childElementCount){
      const tr = el("tr"); tr.append(el("td",{colSpan:6, className:"help", textContent:"Você ainda não tem reservas."}));
      tbody.append(tr);
    }
  }catch(err){ showErr(err.message); }

  $("#logoutBtn").onclick = async () => { await signOut(auth); location.hash="#/login"; };
}

// --- Páginas legais (rascunhos mínimos) ---
async function renderPrivacidade(){
  $("#view").innerHTML = `
    <section class="card">
      <h1>Política de Privacidade (rascunho)</h1>
      <p>Uso interno do condomínio. Coletamos somente dados necessários para reservas (nome, contato, apto, datas e horários).</p>
      <p>Dados ficam no Firebase (Google). Para remoção/retificação, contate a administração.</p>
    </section>`;
}
async function renderTermos(){
  $("#view").innerHTML = `
    <section class="card">
      <h1>Termos de Uso (rascunho)</h1>
      <ul>
        <li>Reservas destinam-se a condôminos autorizados.</li>
        <li>Respeite as regras da área e horários.</li>
        <li>O condomínio pode cancelar reservas em caso de descumprimento.</li>
      </ul>
    </section>`;
}

// --- Utilidades ---
function fieldInput(labelTxt, id, type, value, oninput){
  const w = el("div");
  w.append(
    el("label",{htmlFor:id, textContent:labelTxt}),
    el("input",{id, type, value, oninput:(e)=>oninput?.(e.target.value)})
  );
  return w;
}
function fieldTextarea(labelTxt, id){
  const w = el("div");
  w.append(
    el("label",{htmlFor:id, textContent:labelTxt}),
    el("textarea",{id, rows:3})
  );
  return w;
}
function fieldSelect(labelTxt, id, options, onchange){
  const w = el("div");
  const s = el("select",{id, onchange:(e)=>onchange?.(e.target.value)});
  options.forEach(o=> s.append(el("option",{value:o.id, textContent:o.name})) );
  w.append(el("label",{htmlFor:id, textContent:labelTxt}), s);
  return w;
}
function today(){
  const d = new Date();
  const z = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
}
function toMin(hhmm){ const [h,m]=hhmm.split(":").map(Number); return h*60+m; }
function overlap(aStart,aEnd,bStart,bEnd){
  return toMin(aStart) < toMin(bEnd) && toMin(aEnd) > toMin(bStart);
}
async function hasConflict(areaId, date, start, end){
  const qs = query(collection(db,"parties"), where("areaId","==",areaId), where("date","==",date));
  const snap = await getDocs(qs);
  const conflicts = [];
  snap.forEach(d=>{
    const r = d.data();
    if(r.status!=="cancelado" && overlap(start,end,r.start,r.end)) conflicts.push({ id:d.id, ...r });
  });
  return conflicts;
}
function badgeStatus(s){
  const c = s==="ativo"?"ok":(s==="cancelado"?"err":"warn");
  return `<span class="badge ${c}">${s||"—"}</span>`;
}

// --- SW (registrar) ---
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

// --- inicialização imediata ---
document.addEventListener("DOMContentLoaded", ()=>{
  document.getElementById("appTitle").textContent = APP_NAME || "Festas";
  if(!location.hash) location.hash = "#/login";
  navigate();
});