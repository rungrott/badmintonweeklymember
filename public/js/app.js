// Firebase config
const VERSION = "1.6.2";
//const VERSION_DESC = "add bootstrap for Responsive UI"; // 1.0.1
//const VERSION_DESC = "new feature add anonymous user";  // 1.1
// const VERSION_DESC = "New feature add field isHere for each member, random team";  // 1.2
// const VERSION_DESC = "add toggle check all member";  // 1.3
// const VERSION_DESC = "add navigator menu";  // 1.4
// const VERSION_DESC = "add allow anonymous flag to allow or not allow anonymous login";  // 1.5
const VERSION_DESC = "add GTM for track web site";  // 1.6
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
    vm.randomTeamList = [];
    vm.nickname = '';
    vm.courtName = '';
    vm.playDate = '';
    vm.memberLimitReached = false;
    vm.showTimestamp = true;
    vm.MEMBER_LIMIT = 10;
    vm.version = VERSION;
    vm.versionDesc = VERSION_DESC;
    vm.checkAllMemberFlag = false;
    vm.currentMenu = "home";
    vm.allowAnonymous = false;
    vm.menuToggle = document.getElementById('navbarNav');
    vm.bsCollapse = new bootstrap.Collapse(vm.menuToggle, {toggle:false})
  
    vm.doInit = async function(){
        const webConfigDoc = await db.collection("config").doc("webconfig").get();
        if(webConfigDoc.exists){
            const webConfig = webConfigDoc.data();
            vm.MEMBER_LIMIT = webConfig.maxMember;
            vm.playDate = webConfig.playDate;
            vm.courtName = webConfig.courtName;
            vm.showTimestamp = webConfig.showTimestamp;
            vm.allowAnonymous = webConfig.allowAnonymous;
            $scope.$apply();
        }
        if(vm.user == null || vm.user.isAnonymous == true){
          vm.user = {};
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
      vm.isAdmin = false;
      vm.currentMenu = "home";
      vm.bsCollapse.hide();
      auth.signOut();
    };
  
    // On Auth State Changed
    auth.onAuthStateChanged(async function(user) {
      vm.currentMenu = "home";
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
            vm.isAdmin = false;
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
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        isHere: false
      });
  
      vm.nickname = '';
      loadMembers();
    };
    vm.toggleIsHere = function (member) {
      member.isHere = member.isHere == null ? true: !member.isHere;
      updateMember(member);
    };
    
    function updateMember(member){
      firebase.firestore().collection("weekly_members").doc(member.id).update({
        isHere: member.isHere
      }).then(() => {
        console.log("Updated isHere to:", member.isHere);
      });
    }
  
    // Admin: delete member
    vm.deleteMember = async function(member) {
      if(window.confirm(`ต้องการลบสมาชิก : ${member.nickname} `)){
        await db.collection("weekly_members").doc(member.id).delete();
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
                showTimestamp: vm.showTimestamp,
                allowAnonymous: vm.allowAnonymous
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

    vm.randomteam = function(){
      var memberHereList = getMemberIsHere(); 
      shuffle(memberHereList)
      vm.randomTeamList = doRandomMember(memberHereList);
      shuffle(vm.randomTeamList);
    }

    function getMemberIsHere(){
      var memberHereList = [];
      for(const member of vm.members){
        if(member.isHere == true){
          memberHereList.push(member.nickname);
        }
      }
      return memberHereList;
    }

    function doRandomMember(memberList){
      var randomTeamList = [];
      var i = 0;
      while(i<memberList.length){
        var j = i+1;
        if(j<memberList.length){
          randomTeamList.push(memberList[i]+" - "+memberList[j]);
        }else{
          randomTeamList.push(memberList[i]);
        }
        i = i+2;
      }
      return randomTeamList;
    }

    function shuffle(array) {
      let currentIndex = array.length;
    
      // While there remain elements to shuffle...
      while (currentIndex != 0) {
    
        // Pick a remaining element...
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
    
        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
          array[randomIndex], array[currentIndex]];
      }
    }

    vm.toggleCheckAllMember = function(){
      vm.checkAllMemberFlag = !vm.checkAllMemberFlag;
      for(const member of vm.members){
        member.isHere = vm.checkAllMemberFlag;
        updateMember(member);
      }
    }

    vm.changeMenu = function(menuName){
      vm.currentMenu = menuName;
      vm.bsCollapse.toggle();
      console.log(`currentMenu=${vm.currentMenu}, toggleNav=${vm.bsCollapse.toggle}`);
    };

  });