import { app, db, auth } from './firebase.js'; // ✅ reuse shared instance

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const blogPosts = document.getElementById("blog-posts");
const addPostBtn = document.getElementById("add-post-btn");
const adminControls = document.getElementById("admin-controls");

function renderPost(docSnap, isAdmin) {
  const data = docSnap.data();
  const postDiv = document.createElement("div");
  postDiv.className = "blog-post";

  const title = document.createElement("h3");
  title.textContent = data.title;

  const content = document.createElement("p");
  content.textContent = data.content;

  postDiv.appendChild(title);
  postDiv.appendChild(content);

  if (isAdmin) {
    const actions = document.createElement("div");
    actions.className = "blog-actions";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = async () => {
      const newTitle = prompt("New title:", data.title);
      const newContent = prompt("New content:", data.content);
      if (newTitle && newContent) {
        await updateDoc(doc(db, "blog", docSnap.id), {
          title: newTitle,
          content: newContent
        });
        location.reload();
      }
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = async () => {
      await deleteDoc(doc(db, "blog", docSnap.id));
      location.reload();
    };

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    postDiv.appendChild(actions);
  }

  blogPosts.appendChild(postDiv);
}

async function loadPosts(isAdmin) {
  blogPosts.innerHTML = "";
  const snapshot = await getDocs(collection(db, "blog"));
  console.log("Loaded blog posts:", snapshot.size); // 🔍 log post count
  snapshot.forEach(docSnap => {
    console.log("Post data:", docSnap.data()); // 🔍 view each post
    renderPost(docSnap, isAdmin);
  });
}

onAuthStateChanged(auth, async user => {
  const isAdmin = user && user.email === "chmasciangioli@gmail.com"; // ✏️ Adjust email or role check
  if (isAdmin) {
    adminControls.style.display = "block";
  }
  loadPosts(isAdmin);
});

addPostBtn?.addEventListener("click", async () => {
  const title = prompt("Post title:");
  const content = prompt("Post content:");
  if (title && content) {
    await addDoc(collection(db, "blog"), { title, content });
    location.reload();
  }
});
