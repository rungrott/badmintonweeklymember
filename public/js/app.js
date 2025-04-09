// Firebase config
//const VERSION = "1.0.1";
const VERSION = "1.1";
//const VERSION_DESC = "add bootstrap for Responsive UI";
const VERSION_DESC = "new feature add anonymous user";

const firebaseConfig = {
    apiKey: "AIzaSyBCbO0XyJWgjaG2njpnsGoOIeGImjjLEb8",
    authDomain: "badmintonweeklymember.firebaseapp.com",
    projectId: "badmintonweeklymember",
    storageBucket: "badmintonweeklymember.firebasestorage.app",
    messagingSenderId: "989527524097",
    appId: "1:989527524097:web:ab1ad8f16344ce20fe9100"
  };
const annonymousUser = {
  email: "anonymous@dummymail.com",
  displayName: "Anonymous",
  uid: "anonymouse.uid"
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
    vm.version = VERSION;
    vm.versionDesc = VERSION_DESC;
  
    vm.doInit = async function(){
        const webConfigDoc = await db.collection("config").doc("webconfig").get();
        if(webConfigDoc.exists){
            const webConfig = webConfigDoc.data();
            vm.MEMBER_LIMIT = webConfig.maxMember;
            vm.playDate = webConfig.playDate;
            vm.courtName = webConfig.courtName;
            vm.showTimestamp = webConfig.showTimestamp;
        }
        if(vm.user.isAnonymous == true){
          vm.user.email = "anonymous@badmintonweeklymember.firebasestorage.app";
          vm.user.displayName = "Anonymous";
          vm.user.uid = "anonymouse.uid";
        }
    }
    // Login with Google
    vm.loginWithGoogle = function() {
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider);
    };

    vm.loginWithAnonymous = function(){
      firebase.auth().signInAnonymously().then(() => {
        console.log("Signed in as anonymous");
      }).catch((error) => {
        console.error("Error signing in anonymously:", error);
      });
    };
  
    // Logout
    vm.logout = function() {
      auth.signOut();
    };
  
    // On Auth State Changed
    auth.onAuthStateChanged(async function(user) {
      console.log("onAuthStateChange : user="+JSON.stringify(user));
      $scope.$apply(() => {
        vm.user = user;
      });
      if (user) {
        if(!user.isAnonymous){
            // Check role
          console.log("user.email : "+user.email);
          const userDoc = await db.collection("users").doc(user.email).get();
          vm.isAdmin = userDoc.exists && userDoc.data().role === "admin";
        }else{
          console.log("setup annonymous user");
          $scope.$apply(() => {
            vm.user = annonymousUser;
          });
          
        }
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
      if(window.confirm(`ต้องการลบสมาชิก : ${id} `)){
        await db.collection("weekly_members").doc(id).delete();
        loadMembers();
      }
      
    };
  
    // Admin: reset all
    vm.resetAll = async function() {
      if(window.confirm("ต้องการลบสมาชิกทั้งหมดใช่ไหม")){
        const snapshot = await db.collection("weekly_members").get();
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        loadMembers();
      }
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

    vm.reload = async function(){
      vm.doInit();
      loadMembers();
    };

  });