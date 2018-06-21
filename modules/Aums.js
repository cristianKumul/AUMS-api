const rp = require('request');
const cheerio = require('cheerio');
const Promise = require('bluebird');
const BASE_URL = 'https://aums-apps-6.amrita.edu:8443'
let login_url =  BASE_URL + '/cas/login?service=https%3A%2F%2Faums-apps-6.amrita.edu%3A8443%2Faums%2FJsp%2FCore_Common%2Findex.jsp%3Ftask%3Doff'

let url_list = {
    HomePage:BASE_URL+'/aums/Jsp' + '/DefineComponent/StaffHomePage.jsp?action=UMS-EVAL_CLASSHEADER_SCREEN_LINK',
    registrationStatus:BASE_URL+'/aums/Jsp' + '/Student/StudentRegistrationStatus.jsp?action=UMS-SRM_INIT_STUDENT_REGISTRATION_STATUS&isMenu=true',
    viewMarks:BASE_URL+'/aums/Jsp'+'/Marks/ViewPublishedMark.jsp?action=UMS-EVAL_STUDMARKVIEW_INIT_SCREEN&isMenu=true',
    viewGrades:BASE_URL+'/aums/Jsp'+'/StudentGrade/StudentPerformanceWithSurvey.jsp?action=UMS-EVAL_STUDPERFORMSURVEY_INIT_SCREEN&isMenu=true',
    viewAttendance:BASE_URL+'/aums/Jsp'+'/Attendance/AttendanceReportStudent.jsp?action=UMS-ATD_INIT_ATDREPORTSTUD_SCREEN&isMenu=true',
    viewFee:BASE_URL+'/aums/Jsp'+'/Finance/StudentFeeDetails.jsp?action=UMS-FINANCE_FEEDET_INIT_SCREEN&isMenu=true',
    viewDues:BASE_URL+'/aums/Jsp'+'/NoDues/ViewDues.jsp?action=UMS-NODUES_INIT_VIEW_DUES&isMenu=true'

}

/* Session Constructor */

function Session(username,password){
    this.username = username;
    this.password = password;
    this.loggedIn = false;
    var cookieJar = rp.jar();
    this.request = rp.defaults({
        followAllRedirects:true,
        headers:{
            'Connection': 'keep-alive',  
            'Accept-Encoding': 'gzip, deflate', 
            'Accept': '*/*', 
            'User-Agent': 'requests'
        },
        jar:cookieJar
    });
    
    
}


Session.prototype.login = Promise.coroutine(function *(username,password){
    var self = this;
    if(!self.loggedIn){
        var request = self.request;
        var post = function(url,form){
            
            return new Promise(function(resolve,reject){
                request.post({url:url,form:form},function(err,response,body){
                    if (err) throw err;
                    let $ = cheerio.load(body);
                    
                    if($('input[name="lt"]').val()){
                        console.log("Unsuccessful login..");
                        reject();
                    }
                    else{
                        var user = $('td[class="style3"]').html()
                        var name = user.substr(0,user.indexOf('('));
                        self.loggedIn = true;
                        resolve(name);
                    }
                })
            });
        };

        yield new Promise(function(resolve,reject){
            request({url:login_url},function(err,response,body){
                if (err) throw err;
                let $ = cheerio.load(body);
                self.lt = $('input[name="lt"]').val();
                self._eventId = $('input[name="_eventId"]').val();
                self.submit = $('input[name="submit"]').val();
                resolve();
            });
        });

        let formData = {
            username:username,
            password:password,
            lt:self.lt,
            _eventId:self._eventId,
            submit:self.submit
        }
        self.name = yield post(login_url,formData);
       console.log(self.name);
    }

    return self.name;

});


Session.prototype.getAnnouncements = Promise.coroutine(function *(){
    var self = this;
    var url = url_list.HomePage;
    var request = self.request;
    yield self.login(self.username,self.password);

    yield new Promise(function(resolve,reject){
        request(url,function(err,response,body){
            resolve();
        });
    });
    
});

Session.prototype.getGrades = Promise.coroutine(function *(sem){
    var self = this;
    var url = url_list.viewGrades;
    var request = self.request;
    self.name = yield self.login(self.username,self.password);

    yield new Promise(function(resolve,reject){
        request(url,function(err,response,body){
            resolve();
        });
    });
    
});



Session.prototype.Attendance = Promise.coroutine(function *(sem,type){
    
    if(type){
        var type = type.toLowerCase();
        if(type.contains("lab") || type.contains("practical")){
            type = 2;
        }
        else{
            type = 1;
        }
    }
    else{
        type = 1;
    }
    var self = this;
    var url = url_list.viewAttendance;
    var request = self.request;
    self.name = yield self.login(self.username,self.password);

    yield new Promise(function(resolve,reject){
        request(url,function(err,response,body){
            if(err) throw err;
            let $  = cheerio.load(body);
            let formData = {};
            formData.Page_refIndex_hidden = $('input[name="Page_refIndex_hidden"]').val();
            formData.htmlPageTopContainer_txtrollnumber = $('input[name="htmlPageTopContainer_txtrollnumber"]').val();
            formData.htmlPageTopContainer_hiddentSummary = $('input[name="htmlPageTopContainer_hiddentSummary"]').val();
            formData.htmlPageTopContainer_status = $('input[name="htmlPageTopContainer_status"]').val();
            formData.htmlPageTopContainer_action = 'UMS-ATD_SHOW_ATDSUMMARY_SCREEN';
            formData.htmlPageTopContainer_notify = $('input[name="htmlPageTopContainer_notify"]').val();
            formData.htmlPageTopContainer_hidrollNo = $('input[name="htmlPageTopContainer_hidrollNo"]').val();
            let semselect = $('select[name="htmlPageTopContainer_selectSem"]').children();
            formData.htmlPageTopContainer_selectType = '' + type;
            formData.htmlPageTopContainer_selectCourse = '0';

            semselect.each(function(i,elem){
                if ($(this).text() == sem){
                    formData.htmlPageTopContainer_selectSem = $(this).val();
                }
            });


            for(var key in formData){
                if(formData.hasOwnProperty(key)){
                   if(!formData[key]){
                       formData[key] = '';
                   }
                }
            }
            
            console.log(formData);
            // Request to fetch all the courses from the specific semester.
            request.post({uri:url,form:formData},function(err,response,body){
                if (err) throw err;
                let $ = cheerio.load(body);
                $('select[name="htmlPageTopContainer_selectCourse"]').children().each(function(i,elem){
                    console.log($(this).text());
                });
                resolve();
            });
        });
    });    
});

Session.prototype.getAssignments = Promise.coroutine(function *(courseCode){
    var self = this;
    var request = self.request;
    self.name = yield self.login(self.username,self.password);
});






let s1 = new Session('AM.EN.U4CSE16126','qwerty');

s1.getAttendance(3);