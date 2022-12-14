/* global debounce appVariables fetchApi fetchSocket ChatHtmlGenerators updateAvatars socket */

{
  class ChatComponent {
    me = null;

    rooms = [];

    activeRoom = null;

    activeRoomMessages = [];

    openedRoomsState = {};

    isSearchMode = false;

    searchResults = [];

    domElements = {
      roomsList: null,
      roomHeader: null,
      messagesList: null,
      sendForm: null,
      sendFormTextInput: null,
      searchForm: null,
    };

    socket = null;

    constructor(roomsList, roomHeader, messagesList, sendForm, searchForm) {
      this.domElements.roomsList = roomsList;
      this.domElements.roomHeader = roomHeader;
      this.domElements.messagesList = messagesList;
      this.domElements.sendForm = sendForm;
      this.domElements.sendFormTextInput = sendForm.querySelector('[name="text"]');
      this.domElements.searchForm = searchForm;
      this.domElements.searchFormTextInput = searchForm.querySelector('[name="query"]');
      this.init();
    }

    // --- ACTIONS ---

    async init() {
      this.addSendFormListeners();
      this.addSearchFormListeners();

      this.initSocket();

      await this.fetchMe();

      await this.fetchRooms();
      this.renderRooms();
    }

    async changeActiveRoom(roomId) {
      if (roomId === undefined || this.activeRoom?.id === roomId) {
        return;
      }
      this.rememberCurrentRoomState();
      await this.fetchActiveRoom(roomId);
      this.renderActiveRoom();
    }

    rememberCurrentRoomState() {
      if (this.activeRoom === null) {
        return;
      }
      this.openedRoomsState[this.activeRoom.id] = {
        sendForm: {
          text: this.domElements.sendFormTextInput.value,
        },
      };
    }

    createMessage() {
      if (this.activeRoom === null || this.domElements.sendFormTextInput.value.length === 0) {
        return;
      }
      const createData = {
        roomId: this.activeRoom.id,
        text: this.domElements.sendFormTextInput.value,
      };
      this.fetchCreateMessage(createData);
      this.domElements.sendFormTextInput.value = '';
    }

    scrollToEndOfMessageList() {
      this.domElements.messagesList.parentElement.scrollTo({
        top: this.domElements.messagesList.scrollHeight + 99999,
      });
    }

    doSearch() {
      if (this.domElements.searchFormTextInput.value.length < 2) {
        this.isSearchMode = false;
        this.renderRooms();
        return;
      }

      this.isSearchMode = true;

      const getData = {
        query: this.domElements.searchFormTextInput.value,
      };
      this.fetchUsers(getData)
        .then((resJSON) => {
          this.searchResults = resJSON.data;
          this.renderSearchResults();
        });
    }

    doSearchDebounced = debounce(this.doSearch, 500);

    async createRoom(userId) {
      const createData = {
        userId,
      };
      const resJSON = await this.fetchCreateRoom(createData);
      await this.fetchRooms();
      this.changeActiveRoom(resJSON.data);
    }

    processNewMessage(message) {
      // move message.room to the top in the list
      const roomIndex = this.rooms.findIndex((r) => r.id === message.room);
      if (roomIndex !== -1) {
        const room = this.rooms[roomIndex];
        this.rooms.splice(roomIndex, 1);
        this.rooms.splice(0, 0, {
          ...room,
          lastMessage: message,
        });
        this.renderRooms();
      }
      // add to activeRoomMessages if the room is active
      if (this.activeRoom !== null && message.room === this.activeRoom.id) {
        this.activeRoomMessages.push(message);
        this.renderActiveRoomMessages();
      }
    }

    processNewRoom(room) {
      this.rooms.splice(0, 0, room);
      this.renderRooms();
    }

    processUserOnlineChange(userId, online) {
      let userIndex = -1;
      this.rooms = this.rooms.map((room) => {
        userIndex = room.users.findIndex((user) => user.id === userId);
        if (userIndex === -1) {
          return room;
        }

        room.users.splice(userIndex, 1, {
          ...room.users[userIndex],
          online,
        });

        return {
          ...room,
        };
      });
      this.renderRooms();
    }

    // --- HELPERS ---

    getUserOfMessage(message) {
      const user = this.activeRoom.users.find((u) => message.user === u.id);
      return user !== undefined ? user : this.me;
    }

    setRoomVirtualProperties(room, rewriteProperties = {}) {
      const isActiveRoom = this.activeRoom !== null && this.activeRoom.id === room.id;

      const usersOnlineCount = room.users.reduce(
        (acc, user) => acc + (user.online ? 1 : 0),
        0,
      );

      // NOTE: room is considered "online" if at least half the users (-1 self) are online
      const roomOnline = usersOnlineCount > room.users.length / 2;

      const somebodyTyping = null;

      return {
        ...room,
        isActiveRoom,
        roomOnline,
        somebodyTyping,
        ...rewriteProperties,
      };
    }

    setRoomsVirtualProperties() {
      this.rooms = this.rooms.map(this.setRoomVirtualProperties.bind(this));
    }

    // --- FETCHES ---

    async fetchMe() {
      const resJSON = (this.socket !== null)
        ? await fetchSocket('users:get-me')
        : await fetchApi(`${appVariables.apiBaseUrl}/users/me`);
      this.me = resJSON.data;
    }

    async fetchUsers(getData) {
      if (this.socket !== null) {
        return fetchSocket('users:find-all', getData);
      }
      return fetchApi(`${appVariables.apiBaseUrl}/users`, 'GET', getData);
    }

    async fetchRooms() {
      const resJSON = (this.socket !== null)
        ? await fetchSocket('rooms:find-all')
        : await fetchApi(`${appVariables.apiBaseUrl}/rooms`);
      this.rooms = resJSON.data;
    }

    async fetchActiveRoom(roomId) {
      const resJSON = (this.socket !== null)
        ? await fetchSocket('rooms:find-by-id', { roomId })
        : await fetchApi(`${appVariables.apiBaseUrl}/rooms/${roomId}`);
      this.activeRoom = this.setRoomVirtualProperties(resJSON.data, { isActiveRoom: true });
    }

    async fetchActiveRoomMessages(roomId) {
      const resJSON = (this.socket !== null)
        ? await fetchSocket('messages:find-all-by-room-id', { roomId })
        : await fetchApi(`${appVariables.apiBaseUrl}/messages/room/${roomId}`);
      this.activeRoomMessages = resJSON.data;
    }

    async fetchCreateRoom(createData) {
      if (this.socket !== null) {
        return fetchSocket('rooms:create', createData);
      }
      return fetchApi(`${appVariables.apiBaseUrl}/rooms`, 'POST', createData);
    }

    async fetchCreateMessage(createData) {
      if (this.socket !== null) {
        return fetchSocket('messages:create', createData);
      }
      return fetchApi(`${appVariables.apiBaseUrl}/messages`, 'POST', createData);
    }

    // --- LISTENERS ---

    roomsListItemOnClick = (e) => {
      const item = e.target;
      this.changeActiveRoom(item.dataset.roomId);

      // visual
      const items = item.parentElement.children;
      for (let i = 0; i < items.length; i += 1) {
        items[i].classList.remove('active');
      }
      item.classList.add('active');
    };

    addRoomsListeners() {
      const roomsListItems = document.querySelectorAll('.chat-rooms-list-item');
      roomsListItems.forEach((roomsListItem) => {
        roomsListItem.addEventListener('click', this.roomsListItemOnClick);
      });
    }

    removeRoomsListeners() {
      const roomsListItems = document.querySelectorAll('.chat-rooms-list-item');
      roomsListItems.forEach((roomsListItem) => {
        roomsListItem.removeEventListener('click', this.roomsListItemOnClick);
      });
    }

    searchResultsListItemOnClick = (e) => {
      const item = e.target;
      this.createRoom(item.dataset.userId);
    };

    addSearchResultsListeners() {
      const roomsListItems = document.querySelectorAll('.chat-rooms-list-item');
      roomsListItems.forEach((roomsListItem) => {
        roomsListItem.addEventListener('click', this.searchResultsListItemOnClick);
      });
    }

    removeSearchResultsListeners() {
      const roomsListItems = document.querySelectorAll('.chat-rooms-list-item');
      roomsListItems.forEach((roomsListItem) => {
        roomsListItem.removeEventListener('click', this.searchResultsListItemOnClick);
      });
    }

    sendFormOnSubmit = (e) => {
      e.preventDefault();
      this.createMessage();
    };

    sendFormTextInputOnKeydown = (e) => {
      // CTRL + ENTER to submit a form
      if (!(e.keyCode === 13 && (e.metaKey || e.ctrlKey))) return;
      this.createMessage();
    };

    addSendFormListeners() {
      this.domElements.sendForm.addEventListener('submit', this.sendFormOnSubmit);
      this.domElements.sendFormTextInput.addEventListener('keydown', this.sendFormTextInputOnKeydown);
    }

    searchFormOnSubmit = (e) => {
      e.preventDefault();
      this.doSearchDebounced();
    };

    searchFormTextInputOnKeyup = () => {
      if (this.domElements.searchFormTextInput.value.length > 0) {
        this.doSearchDebounced();
      } else {
        this.doSearch();
      }
    };

    addSearchFormListeners() {
      this.domElements.searchForm.addEventListener('submit', this.searchFormOnSubmit);
      this.domElements.searchFormTextInput.addEventListener('keyup', this.searchFormTextInputOnKeyup);
    }

    initSocket() {
      if (typeof socket === 'undefined') {
        console.error('socket.io not initialized. REST API will be used.');
        this.addPseudoSocketEventsListeners();
        return;
      }
      this.socket = socket;
      this.addSocketEventsListeners();
    }

    addSocketEventsListeners() {
      this.socket.on('message:create', (message) => {
        this.processNewMessage(message);
      });
      this.socket.on('room:create', (room) => {
        this.processNewRoom(room);
      });
      this.socket.on('user:online', (userId) => {
        this.processUserOnlineChange(userId, true);
      });
      this.socket.on('user:offline', (userId) => {
        this.processUserOnlineChange(userId, false);
      });
    }

    addPseudoSocketEventsListeners() {
      // TODO: add polling for new messages and other events ?
    }

    // --- RENDERS ---

    renderRooms() {
      if (this.isSearchMode) {
        return;
      }
      let html = '';

      if (this.rooms.length > 0) {
        this.setRoomsVirtualProperties();
        html = this.rooms.map(ChatHtmlGenerators.roomListItemHTML).join('');
      } else {
        html = '<li>Your rooms list is empty.<br />Search for a friend and create one!</li>';
      }

      this.removeRoomsListeners();
      this.domElements.roomsList.innerHTML = html;
      this.addRoomsListeners();
      updateAvatars();
    }

    renderSearchResults() {
      if (!this.isSearchMode) {
        return;
      }
      let html = '';

      if (this.searchResults.length > 0) {
        html = this.searchResults.map(ChatHtmlGenerators.searchResultListItemHTML).join('');
      } else {
        html = '<li>No results for your input..</li>';
      }

      this.removeSearchResultsListeners();
      this.domElements.roomsList.innerHTML = html;
      this.addSearchResultsListeners();
      updateAvatars();
    }

    async renderActiveRoom() {
      if (this.activeRoom === null) {
        // IDEA: render overlay?
        return;
      }
      this.renderActiveRoomHeader();
      this.renderActiveRoomSendForm();

      await this.fetchActiveRoomMessages(this.activeRoom.id);
      this.renderActiveRoomMessages();
    }

    renderActiveRoomHeader() {
      this.domElements.roomHeader.innerHTML = ChatHtmlGenerators.roomHeaderHTML(this.activeRoom);
      updateAvatars();
    }

    renderActiveRoomMessages() {
      let html = '';

      if (this.activeRoomMessages.length > 0) {
        html = this.activeRoomMessages
          .map((message) => {
            const user = this.getUserOfMessage(message);
            const isMeCreator = user.id === this.me.id;
            return ChatHtmlGenerators.messageListItemHTML(message, user, isMeCreator);
          })
          .join('');
      } else {
        html = '<li class="text-center mt-4">No messages yet</li>';
      }

      this.domElements.messagesList.innerHTML = html;

      this.scrollToEndOfMessageList();
    }

    renderActiveRoomSendForm() {
      let textInputValue = '';
      if (this.openedRoomsState[this.activeRoom.id] !== undefined) {
        textInputValue = this.openedRoomsState[this.activeRoom.id].sendForm.text;
      }
      this.domElements.sendFormTextInput.value = textInputValue;
    }
  }

  window.ChatComponent = ChatComponent;
}
