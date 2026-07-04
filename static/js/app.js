"use strict";

/* ================= DOM ================= */

const chatContainer = document.getElementById("chatContainer");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const typingIndicator = document.getElementById("typingIndicator");

const newChatBtn = document.getElementById("newChatBtn");
const clearChatsBtn = document.getElementById("clearChats");

const historyContainer = document.getElementById("chatHistory");
const historySearch = document.getElementById("historySearch");

const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const menuButton = document.getElementById("menuButton");

const themeToggle = document.getElementById("themeToggle");
const toast = document.getElementById("toast");
const welcome = document.getElementById("welcome");

const attachButton = document.getElementById("attachButton");
const fileInput = document.getElementById("fileInput");
const attachmentChip = document.getElementById("attachmentChip");
const attachmentIcon = document.getElementById("attachmentIcon");
const attachmentName = document.getElementById("attachmentName");
const removeAttachmentBtn = document.getElementById("removeAttachment");

/* ================= STATE ================= */

const STORAGE_KEY = "nova_conversations";
const THEME_KEY = "nova_theme";

const NOVA_MARK_SVG = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#F0A93E"/><stop offset="100%" stop-color="#4FD1C5"/>
  </linearGradient></defs>
  <path fill="url(#avatarGrad)" d="M24 2 L27 20 L46 24 L27 28 L24 46 L21 28 L2 24 L21 20 Z"/>
</svg>`;

let conversations = [];
let currentConversationId = null;
let streaming = false;

// pendingAttachment: { kind: "image"|"text", name, dataUrl?, content? }
let pendingAttachment = null;

const TEXT_EXTENSIONS = [".txt",".md",".csv",".json",".log"];
const MAX_TEXT_FILE_CHARS = 6000;

/* ================= UTIL ================= */

function uuid(){
    return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

function scrollBottom(){
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function autoResize(){
    messageInput.style.height="auto";
    messageInput.style.height=messageInput.scrollHeight+"px";
}

/* ================= TOAST ================= */

function showToast(msg){
    if(!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(()=>toast.classList.remove("show"),2000);
}

/* ================= ATTACHMENTS ================= */

function clearAttachment(){
    pendingAttachment = null;
    attachmentChip.classList.add("hidden");
    fileInput.value = "";
}

function showAttachmentChip(icon, name){
    attachmentIcon.textContent = icon;
    attachmentName.textContent = name;
    attachmentChip.classList.remove("hidden");
}

function handleFileSelected(file){
    if(!file) return;

    const lowerName = file.name.toLowerCase();
    const isImage = file.type.startsWith("image/");
    const isText = TEXT_EXTENSIONS.some(ext => lowerName.endsWith(ext));

    if(isImage){
        const reader = new FileReader();
        reader.onload = () => {
            pendingAttachment = { kind:"image", name:file.name, dataUrl:reader.result };
            showAttachmentChip("🖼️", file.name);
        };
        reader.onerror = () => showToast("Couldn't read that image");
        reader.readAsDataURL(file);
        return;
    }

    if(isText){
        const reader = new FileReader();
        reader.onload = () => {
            let content = reader.result;
            let truncated = false;
            if(content.length > MAX_TEXT_FILE_CHARS){
                content = content.slice(0, MAX_TEXT_FILE_CHARS);
                truncated = true;
            }
            pendingAttachment = { kind:"text", name:file.name, content, truncated };
            showAttachmentChip("📎", file.name);
            if(truncated) showToast("File is large — using the first part of it");
        };
        reader.onerror = () => showToast("Couldn't read that file");
        reader.readAsText(file);
        return;
    }

    showToast("Unsupported file type — try .txt, .md, .csv, .json, or an image");
}

/* ================= THEME ================= */

function loadTheme(){
    if(localStorage.getItem(THEME_KEY)==="light"){
        document.body.classList.add("light");
    }
}

function toggleTheme(){
    document.body.classList.toggle("light");
    localStorage.setItem(THEME_KEY,
        document.body.classList.contains("light")?"light":"dark"
    );
}

/* ================= SIDEBAR ================= */

function openSidebar(){
    sidebar.classList.add("show");
    sidebarOverlay.classList.remove("hidden");
}

function closeSidebar(){
    sidebar.classList.remove("show");
    sidebarOverlay.classList.add("hidden");
}

/* ================= STORAGE ================= */

function save(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

function load(){
    try{
        conversations = JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
    }catch{
        conversations=[];
    }
}

/* ================= CONVERSATION ================= */

function getCurrent(){
    return conversations.find(c=>c.id===currentConversationId);
}

function createConversation(){
    const c = {id:uuid(), title:"New Chat", messages:[]};
    conversations.unshift(c);
    currentConversationId=c.id;
    save();
    renderList();
    return c;
}

/* ================= RENDER LIST ================= */

function renderList(){
    historyContainer.innerHTML="";
    conversations.forEach(c=>{
        const div=document.createElement("div");
        div.className="chat-item";
        if(c.id===currentConversationId) div.classList.add("active");

        div.innerHTML=`<div class="chat-item-title">${c.title}</div>`;
        div.onclick=()=>{
            currentConversationId=c.id;
            renderChat();
            renderList();
            closeSidebar();
        };

        historyContainer.appendChild(div);
    });
}

/* ================= RENDER CHAT ================= */

function renderChat(){
    chatContainer.innerHTML="";
    const c=getCurrent();
    if(!c || !c.messages.length){
        welcome.classList.remove("hidden");
        return;
    }

    welcome.classList.add("hidden");

    c.messages.forEach((m,i)=>{
        addMessage(m.role,m.content,false,i);
    });
}

/* ================= MESSAGE ================= */

function addMessage(role,text,persist=true,explicitIndex=null){
    welcome.classList.add("hidden");

    const wrap=document.createElement("div");
    wrap.className=`message ${role}`;

    const avatar=document.createElement("div");
    avatar.className=`avatar ${role}`;
    if(role==="user"){
        avatar.textContent="You";
    }else{
        avatar.innerHTML=NOVA_MARK_SVG;
    }

    const bubble=document.createElement("div");
    bubble.className="bubble";

    if(role==="assistant"){
        bubble.innerHTML = DOMPurify.sanitize(marked.parse(text));
    }else{
        bubble.textContent=text;
    }

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);

    let msgIndex = explicitIndex;

    if(persist){
        const c=getCurrent();
        msgIndex = c ? c.messages.length : null;
    }

    if(role==="user" && msgIndex!==null){
        const editBtn=document.createElement("button");
        editBtn.className="edit-msg-btn";
        editBtn.setAttribute("aria-label","Edit message");
        editBtn.innerHTML=`<svg viewBox="0 0 20 20" width="15" height="15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.2 2.8a1.7 1.7 0 0 1 2.4 2.4L7.5 14.3l-3.2.8.8-3.2 9.1-9.1Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        </svg>`;
        editBtn.onclick=()=>editMessage(msgIndex);
        wrap.appendChild(editBtn);
    }

    chatContainer.appendChild(wrap);

    scrollBottom();

    if(persist){
        const c=getCurrent();
        if(c){
            c.messages.push({role,content:text});
            if(c.messages.length===1){
                c.title=text.slice(0,40);
                renderList();
            }
            save();
        }
    }

    return bubble;
}

/* ================= EDIT MESSAGE ================= */

function editMessage(index){
    const c=getCurrent();
    if(!c || !c.messages[index]) return;

    const original=c.messages[index].content;

    c.messages=c.messages.slice(0,index);
    save();
    renderChat();

    messageInput.value=original;
    autoResize();
    messageInput.focus();

    showToast("Edit your message, then send to regenerate");
}

/* ================= STREAM ================= */

async function streamResponse(imageDataUrl){
    const c=getCurrent();

    const bubble=addMessage("assistant","",false);
    let text="";

    try{
        const res=await fetch("/api/chat",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({history:c.messages, image:imageDataUrl || null})
        });

        if(!res.ok){
            throw new Error(`Server returned ${res.status}`);
        }

        const reader=res.body.getReader();
        const decoder=new TextDecoder();

        while(true){
            const {value,done}=await reader.read();
            if(done) break;

            const chunk=decoder.decode(value);
            const events=chunk.split("\n\n");

            for(const e of events){
                if(!e.startsWith("data:")) continue;

                const data=JSON.parse(e.replace("data:",""));

                if(data.token){
                    text+=data.token;
                    bubble.innerHTML=DOMPurify.sanitize(marked.parse(text));
                    scrollBottom();
                }

                if(data.error){
                    bubble.classList.add("error-bubble");
                    bubble.textContent = text
                        ? text + `\n\n[Error: ${data.error}]`
                        : `Something went wrong: ${data.error}`;
                    showToast("Nova hit an error — see message");
                    return;
                }

                if(data.done){
                    c.messages.push({role:"assistant",content:text});
                    save();
                }
            }
        }
    }catch(err){
        bubble.classList.add("error-bubble");
        bubble.textContent = text
            ? text + `\n\n[Connection error: ${err.message}]`
            : `Couldn't reach Nova: ${err.message}`;
        showToast("Connection error");
    }
}

/* ================= SEND ================= */

async function sendMessage(){
    if(streaming) return;

    const rawText=messageInput.value.trim();
    const attachment=pendingAttachment;

    if(!rawText && !attachment) return;

    if(!currentConversationId) createConversation();

    let displayText = rawText;
    let imageToSend = null;

    if(attachment?.kind === "text"){
        const label = `📎 ${attachment.name}${attachment.truncated ? " (truncated)" : ""}`;
        displayText = `${label}\n\n${attachment.content}\n\n---\n\n${rawText || "What can you tell me about this file?"}`;
    } else if(attachment?.kind === "image"){
        const label = `📎 ${attachment.name} (image attached)`;
        displayText = rawText ? `${rawText}\n\n${label}` : `${label}\n\nWhat's in this image?`;
        imageToSend = attachment.dataUrl;
    }

    addMessage("user", displayText);

    messageInput.value="";
    autoResize();
    clearAttachment();

    streaming=true;
    sendButton.disabled=true;

    typingIndicator.classList.remove("hidden");

    try{
        await streamResponse(imageToSend);
    }finally{
        streaming=false;
        sendButton.disabled=false;
        typingIndicator.classList.add("hidden");
    }
}

/* ================= EVENTS ================= */

sendButton.onclick=sendMessage;

messageInput.addEventListener("input",autoResize);

messageInput.addEventListener("keydown",(e)=>{
    if(e.key==="Enter" && !e.shiftKey){
        e.preventDefault();
        sendMessage();
    }
});

menuButton?.addEventListener("click",openSidebar);

sidebarOverlay?.addEventListener("click",closeSidebar);

themeToggle?.addEventListener("click",toggleTheme);

newChatBtn?.addEventListener("click",()=>{
    createConversation();
    renderChat();
    closeSidebar();
});

clearChatsBtn?.addEventListener("click",()=>{
    if(!confirm("Clear all chat history? This can't be undone.")) return;

    conversations = [];
    localStorage.removeItem(STORAGE_KEY);
    currentConversationId = null;

    createConversation();
    renderList();
    renderChat();
    closeSidebar();
    showToast("History cleared");
});

attachButton?.addEventListener("click", () => fileInput.click());

fileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    handleFileSelected(file);
});

removeAttachmentBtn?.addEventListener("click", clearAttachment);

/* ================= INIT ================= */

loadTheme();
load();

if(conversations.length===0) createConversation();
else currentConversationId=conversations[0].id;

renderList();
renderChat();