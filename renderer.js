// Import required modules
const sqlite3 = require("sqlite3").verbose();
const { ipcRenderer } = require("electron");

// Initialize Quill editor
const quill = new Quill("#editor", {
  modules: {
    toolbar: "#toolbar-container",
  },
  placeholder: "Compose an epic...",
  theme: "snow",
});

// Global variables
let currentNoteId = null;
let notesCache = [];
let deleteTimeouts = {};
let pendingDeletions = {};

// DOM element references
const textEditorPage = document.querySelector("#text-editor-page");
const notesListPage = document.querySelector("#notes-list-page");
const notesList = document.querySelector("#notes-list");

// Function to switch to notes list view
function listTheNotes() {
  textEditorPage.style.display = "none";
  notesListPage.style.display = "block";
  renderNotesList();
}

// Function to fetch notes from database and update cache
function listNotes() {
  const db = new sqlite3.Database("my-databse.db");

  db.all(
    "SELECT id, title FROM Test ORDER BY title COLLATE NOCASE",
    [],
    (err, rows) => {
      if (err) {
        console.error(err.message);
        return;
      }

      notesCache = rows;
      renderNotesList();

      db.close();
    }
  );
}

// Function to sort the notes cache alphabetically
function sortNotesCache() {
  notesCache.sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  );
}

// Function to render notes from cache to the UI
function renderNotesList() {
  notesList.innerHTML = "";
  notesCache.forEach((note) => {
    if (!deleteTimeouts[note.id]) {
      // Only render if not pending deletion
      addNoteToList(note.id, note.title);
    }
  });
}

// Function to add a single note to the UI
function addNoteToList(id, title) {
  const noteElement = document.createElement("div");
  noteElement.className = "note-container";
  noteElement.setAttribute("data-note-id", id);
  noteElement.innerHTML = `
    <h2>${title}</h2>
    <div id="note-list-buttons">
      <button class="edit-button" data-note-id="${id}">
        <span class="edit-icon"></span>
      </button>
      <button class="delete-button" data-note-id="${id}">
        <span class="delete-icon"></span>
      </button>
    </div> 
  `;
  noteElement.addEventListener("click", () => getContent(id));
  noteElement
    .querySelector(".delete-button")
    .addEventListener("click", deleteNote);
  noteElement
    .querySelector(".edit-button")
    .addEventListener("click", (event) => editNoteTitle(event, id, title));
  notesList.appendChild(noteElement);
}

// Function to show the note title prompt
function noteTitlePrompt() {
  const titlePromptCard = document.querySelector("#note-title-prompt");
  const newNoteCancelButton = document.querySelector("#new-note-cancel-button");
  const newNoteSaveButton = document.querySelector("#new-note-save-button");

  titlePromptCard.style.display = "inline-block";

  // Remove existing event listeners
  newNoteCancelButton.removeEventListener("click", cancelTitleEdit);
  newNoteSaveButton.removeEventListener("click", saveNewNote);

  // Add new event listeners
  newNoteCancelButton.addEventListener("click", function () {
    titlePromptCard.style.display = "none";
  });
  newNoteSaveButton.addEventListener("click", saveNewNote);
}

// Function to save a new note
function saveNewNote() {
  const content = JSON.stringify(quill.getContents());
  const db = new sqlite3.Database("my-databse.db");
  const newNoteTitleBox = document.querySelector("#note-title-prompt input");
  const title = newNoteTitleBox.value;
  const titlePromptCard = document.querySelector("#note-title-prompt");

  db.run(
    "INSERT INTO Test (title, content) VALUES (?, ?)",
    [title, content],
    function (err) {
      if (err) {
        console.error(err.message);
      } else {
        const newNoteId = this.lastID;
        currentNoteId = newNoteId;
        console.log(`New note created with ID: ${newNoteId}`);
        showNotification(`New note created successfully!`, "success");

        // Add to cache
        notesCache.push({ id: newNoteId, title: title });

        // Sort the cache
        sortNotesCache();

        // Re-render the list if in list view
        if (notesListPage.style.display !== "none") {
          renderNotesList();
        }
      }
      db.close();
    }
  );

  titlePromptCard.style.display = "none";
  newNoteTitleBox.value = "";
}

// Function to save an existing note
function saveNote() {
  if (currentNoteId === null) {
    noteTitlePrompt();
  } else {
    const content = JSON.stringify(quill.getContents());
    const db = new sqlite3.Database("my-databse.db");

    db.run(
      "UPDATE Test SET content = ? WHERE id = ?",
      [content, currentNoteId],
      function (err) {
        if (err) {
          console.error(err.message);
        } else {
          console.log(`Note ${currentNoteId} updated successfully`);
          showNotification(`Note saved successfully!`, "success");
        }
        db.close();
      }
    );
  }
}

// Function to show a notification
function showNotification(message, type) {
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.className = `notification ${type}`;
  document.body.appendChild(notification);

  setTimeout(function () {
    notification.style.opacity = "0";
    setTimeout(function () {
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}

// Function to get content of a note and display in editor
function getContent(noteId) {
  currentNoteId = noteId;
  const db = new sqlite3.Database("my-databse.db");

  db.get("SELECT * FROM Test WHERE id = ?", [noteId], (err, row) => {
    if (err) {
      console.error(err.message);
      return;
    }

    const data = row.content;
    console.log(data);
    const delta = JSON.parse(data);
    console.log(delta);
    quill.setContents(delta);

    db.close();
  });

  textEditorPage.style.display = "block";
  notesListPage.style.display = "none";
}

// Function to create a new note
function createNewNote() {
  currentNoteId = null;
  quill.setContents([{ insert: "\n" }]);
  textEditorPage.style.display = "block";
  notesListPage.style.display = "none";
}

// Function to delete a note
function deleteNote(event) {
  event.stopPropagation();
  const noteId = event.currentTarget.getAttribute("data-note-id");
  const noteElement = event.currentTarget.closest(".note-container");

  // Remove from cache and store in pendingDeletions
  const removedNote = notesCache.find((note) => note.id == noteId);
  notesCache = notesCache.filter((note) => note.id != noteId);
  pendingDeletions[noteId] = removedNote;

  // Hide the note immediately
  noteElement.style.display = "none";

  if (currentNoteId = noteId) {
    quill.setContents([{ insert: "\n" }]);
    currentNoteId = null;
  }

  // Show the notification with undo option
  showUndoNotification(noteId);

  // Set a timeout to actually delete the note
  deleteTimeouts[noteId] = setTimeout(() => {
    actuallyDeleteNote(noteId);
  }, 5000);
}

// Function to show undo notification
function showUndoNotification(noteId) {
  const notification = document.createElement("div");
  notification.className = "notification";
  notification.innerHTML = `Note deleted <span class="undo-link">Undo</span>`;

  const undoLink = notification.querySelector(".undo-link");
  undoLink.addEventListener("click", () => undoDelete(noteId, notification));

  document.body.appendChild(notification);

  // Remove the notification after 20 seconds
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 5000);
}

// Function to undo a delete operation
function undoDelete(noteId, notification) {
  // Clear the deletion timeout
  clearTimeout(deleteTimeouts[noteId]);
  delete deleteTimeouts[noteId];

  // Add back to cache from pendingDeletions
  if (pendingDeletions[noteId]) {
    notesCache.push(pendingDeletions[noteId]);
    delete pendingDeletions[noteId];

    // Sort the cache
    sortNotesCache();
  }

  // Re-render the list
  renderNotesList();

  // Remove the notification
  document.body.removeChild(notification);
}

// Function to actually delete a note from the database
function actuallyDeleteNote(noteId) {
  const db = new sqlite3.Database("my-databse.db");

  db.run("DELETE FROM Test WHERE id = ?", [noteId], function (err) {
    if (err) {
      console.error(err.message);
      showNotification("Error deleting note", "error");
    } else {
      console.log(`Note ${noteId} deleted successfully`);
      // Remove from pendingDeletions if it's still there
      delete pendingDeletions[noteId];
    }
    db.close();
  });
}

// Function to edit note title
function editNoteTitle(event, noteId, currentTitle) {
  event.stopPropagation(); // Prevent triggering the note opening

  const titlePromptCard = document.querySelector("#note-title-prompt");
  const titleInput = titlePromptCard.querySelector("input");
  const saveButton = document.querySelector("#new-note-save-button");
  const cancelButton = document.querySelector("#new-note-cancel-button");

  // Set the current title in the input
  titleInput.value = currentTitle;

  // Show the prompt
  titlePromptCard.style.display = "inline-block";

  // Remove existing event listeners
  saveButton.removeEventListener("click", saveNewNote);
  cancelButton.removeEventListener("click", cancelTitleEdit);

  // Add new event listeners
  saveButton.addEventListener("click", () =>
    saveEditedTitle(noteId, titleInput.value)
  );
  cancelButton.addEventListener("click", cancelTitleEdit);
}

// Function to save edited title
function saveEditedTitle(noteId, newTitle) {
  const db = new sqlite3.Database("my-databse.db");

  db.run(
    "UPDATE Test SET title = ? WHERE id = ?",
    [newTitle, noteId],
    function (err) {
      if (err) {
        console.error(err.message);
        showNotification("Error updating note title", "error");
      } else {
        console.log(`Note ${noteId} title updated successfully`);
        showNotification("Note title updated successfully!", "success");

        // Update the cache
        const noteIndex = notesCache.findIndex((note) => note.id == noteId);
        if (noteIndex !== -1) {
          notesCache[noteIndex].title = newTitle;
          sortNotesCache();
        }

        // Re-render the list
        renderNotesList();
      }
      db.close();
    }
  );

  // Hide the prompt
  const titlePromptCard = document.querySelector("#note-title-prompt");
  titlePromptCard.style.display = "none";

  // Clear the input field
  const newNoteTitleBox = titlePromptCard.querySelector("input");
  newNoteTitleBox.value = "";
}

// Function to cancel title edit
function cancelTitleEdit() {
  const titlePromptCard = document.querySelector("#note-title-prompt");
  titlePromptCard.style.display = "none";

  // Clear the input field
  const newNoteTitleBox = titlePromptCard.querySelector("input");
  newNoteTitleBox.value = "";
}

// Function to go back to editor view
function backToEditor() {
  textEditorPage.style.display = "block";
  notesListPage.style.display = "none";
}

// Event listeners
const noteListButton = document.querySelector("#note-list-button");
noteListButton.addEventListener("click", listTheNotes);

const saveNoteButton = document.querySelector("#save-note-button");
saveNoteButton.addEventListener("click", saveNote);

const newNoteButton = document.querySelector("#new-note-button");
newNoteButton.addEventListener("click", createNewNote);

const backButton = document.querySelector("#back-button");
backButton.addEventListener("click", backToEditor);

// Initial setup
listNotes();

document.getElementById("minimize").addEventListener("click", function () {
  ipcRenderer.send("minimize-window");
});

document.getElementById("maximize").addEventListener("click", function () {
  ipcRenderer.send("maximize-window");
});

document.getElementById("close").addEventListener("click", function () {
  ipcRenderer.send("close-window");
});
