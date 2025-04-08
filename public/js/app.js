// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyBCbO0XyJWgjaG2njpnsGoOIeGImjjLEb8",
    authDomain: "badmintonweeklymember.firebaseapp.com",
    projectId: "badmintonweeklymember",
    storageBucket: "badmintonweeklymember.firebasestorage.app",
    messagingSenderId: "989527524097",
    appId: "1:989527524097:web:ab1ad8f16344ce20fe9100"
  };
  
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  
  angular.module('badmintonApp', [])
  .controller('MainController', function($scope) {
    const vm = this;
  
    vm.user = null;
    vm.isAdmin = false;
    vm.members = [];
    vm.nickname = '';
    vm.courtName = '';
    vm.playDate = '';
    vm.memberLimitReached = false;
    vm.showTimestamp = true;
    vm.MEMBER_LIMIT = 10;
  
    vm.doInit = async function(){
        const webConfigDoc = await db.collection("config").doc("webconfig").get();
        if(webConfigDoc.exists){
            const webConfig = webConfigDoc.data();
            vm.MEMBER_LIMIT = webConfig.maxMember;
            vm.playDate = webConfig.playDate;
            vm.courtName = webConfig.courtName;
            vm.showTimestamp = webConfig.showTimestamp;
        }
    }
    // Login with Google
    vm.loginWithGoogle = function() {
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider);
    };
  
    // Logout
    vm.logout = function() {
      auth.signOut();
    };
  
    // On Auth State Changed
    auth.onAuthStateChanged(async function(user) {
      $scope.$apply(() => {
        vm.user = user;
      });
  
      if (user) {
        // Check role
        const userDoc = await db.collection("users").doc(user.email).get();
        vm.isAdmin = userDoc.exists && userDoc.data().role === "admin";
  
        // Load members
        loadMembers();
      }
    });
  
    // Load members
    async function loadMembers() {
      const snapshot = await db.collection("weekly_members")
        .orderBy("timestamp")
        .get();
      
      vm.members = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  
      vm.memberLimitReached = vm.members.length >= vm.MEMBER_LIMIT;
      $scope.$apply();
    }
  
    // Submit nickname
    vm.submitNickname = async function() {
      if (!vm.nickname || vm.memberLimitReached) return;
  
      await db.collection("weekly_members").add({
        nickname: vm.nickname,
        uid: vm.user.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
  
      vm.nickname = '';
      loadMembers();
    };
  
    // Admin: delete member
    vm.deleteMember = async function(id) {
      await db.collection("weekly_members").doc(id).delete();
      loadMembers();
    };
  
    // Admin: reset all
    vm.resetAll = async function() {
      const snapshot = await db.collection("weekly_members").get();
      const batch = db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      loadMembers();
    };

    vm.formatTimestamp = function(timestamp) {
        if (!timestamp || !timestamp.seconds) return '';
        return new Date(timestamp.seconds * 1000);
    };

    vm.saveWebConfig = async function(){
        try{
            db.collection("config").doc("webconfig").update({
                courtName: vm.courtName,
                maxMember: vm.MEMBER_LIMIT,
                playDate: vm.playDate,
                showTimestamp: vm.showTimestamp
            });
            loadMembers();
        }catch(error){
            console.error("update webconfig fail", error);
        }
    };

  });