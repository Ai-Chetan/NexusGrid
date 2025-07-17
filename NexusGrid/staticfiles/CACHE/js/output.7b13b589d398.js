let currentBuilding=null;let currentFloor=null;let instructorLimit=3;let assistantLimit=5;document.addEventListener('DOMContentLoaded',function(){loadStats();loadBuildings();loadAllUsers();setupEventListeners();});function setupEventListeners(){document.getElementById('userSearch').addEventListener('input',function(){filterUsers(this.value);});document.getElementById('settingsForm').addEventListener('submit',function(e){e.preventDefault();saveSettings();});document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab=>{tab.addEventListener('shown.bs.tab',function(e){const target=e.target.getAttribute('data-bs-target');if(target==='#nav-users'){loadAllUsers();}});});}
function loadStats(){fetch('/userprivileges/api/stats/').then(response=>response.json()).then(data=>{document.getElementById('totalUsers').textContent=data.total_users||0;document.getElementById('unassignedUsers').textContent=data.unassigned_users||0;document.getElementById('totalLabs').textContent=data.total_labs||0;document.getElementById('labsWithoutInstructor').textContent=data.labs_without_instructor||0;document.getElementById('labsWithoutAssistant').textContent=data.labs_without_assistant||0;}).catch(error=>{console.error('Error loading stats:',error);document.getElementById('totalUsers').textContent='0';document.getElementById('unassignedUsers').textContent='0';document.getElementById('totalLabs').textContent='0';document.getElementById('labsWithoutInstructor').textContent='0';document.getElementById('labsWithoutAssistant').textContent='0';});}
function loadBuildings(){fetch('/userprivileges/api/buildings/').then(response=>response.json()).then(data=>{displayBuildings(data);}).catch(error=>{console.error('Error loading buildings:',error);displayBuildings([{id:1,name:'Engineering Building',floors_count:5},{id:2,name:'Science Building',floors_count:3},{id:3,name:'Computer Center',floors_count:2}]);});}
function displayBuildings(buildings){const container=document.getElementById('buildingsList');container.innerHTML='';buildings.forEach(building=>{const buildingCard=document.createElement('div');buildingCard.className='col-md-3 mb-3';buildingCard.innerHTML=`
            <div class="building-card" onclick="selectBuilding(${building.id}, '${building.name}')">
                <h5><i class="fas fa-building text-primary"></i> ${building.name}</h5>
                <p class="text-muted">${building.floors_count} floors</p>
            </div>
        `;container.appendChild(buildingCard);});}
function selectBuilding(buildingId,buildingName){currentBuilding={id:buildingId,name:buildingName};currentFloor=null;updateBreadcrumb(['Buildings',buildingName]);fetch(`/userprivileges/api/floors/${buildingId}/`).then(response=>response.json()).then(data=>{displayFloors(data);}).catch(error=>{console.error('Error loading floors:',error);displayFloors([{id:1,name:'Ground Floor',labs_count:3},{id:2,name:'First Floor',labs_count:4},{id:3,name:'Second Floor',labs_count:2}]);});}
function displayFloors(floors){const container=document.getElementById('buildingsList');container.innerHTML='';floors.forEach(floor=>{const floorCard=document.createElement('div');floorCard.className='col-md-12 mb-3';floorCard.innerHTML=`
            <div class="floor-card" onclick="selectFloor(${floor.id}, '${floor.name}')">
                <h5><i class="fas fa-layer-group text-success"></i> ${floor.name}</h5>
                <p class="text-muted">${floor.labs_count} labs</p>
            </div>
        `;container.appendChild(floorCard);});}
function selectFloor(floorId,floorName){currentFloor={id:floorId,name:floorName};updateBreadcrumb(['Buildings',currentBuilding.name,floorName]);fetch(`/userprivileges/api/labs/${floorId}/`).then(response=>response.json()).then(data=>{displayLabs(data);}).catch(error=>{console.error('Error loading labs:',error);});}
function displayLabs(labs){const container=document.getElementById('buildingsList');container.innerHTML='';labs.forEach(lab=>{const labCard=document.createElement('div');labCard.className='col-md-6 mb-3';const instructorBadges=lab.instructors.map(instructor=>`<span class="staff-badge instructor-badge"><span class="me-2">${instructor.username}</span><i class="fa-solid fa-user-minus cursor-pointer" onclick="removeStaff(${lab.id}, ${instructor.id}, 'instructor')"></i></span>`).join('');const assistantBadges=lab.assistants.map(assistant=>`<span class="staff-badge assistant-badge"><span class="me-2">${assistant.username}</span><i class="fa-solid fa-user-minus cursor-pointer" onclick="removeStaff(${lab.id}, ${assistant.id}, 'assistant')"></i></span>`).join('');labCard.innerHTML=`
            <div class="lab-card">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5><i class="fas fa-flask text-info"></i> ${lab.name}</h5>
                    <button class="btn btn-assign btn-sm" onclick="openAssignStaff(${lab.id}, '${lab.name}')">
                        <i class="fas fa-user-plus"></i> Assign
                    </button>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; mb-2">
                    <label for="labDimension-${lab.id}" class="form-label mb-0"><strong>Dimension:</strong></label>
                    <input type="text" class="form-control form-control-sm" id="labDimension-${lab.id}" style="width: 100px;">

                    <label for="labCapacity-${lab.id}" class="form-label mb-0 ms-2"><strong>Capacity:</strong></label>
                    <input type="number" class="form-control form-control-sm" id="labCapacity-${lab.id}" style="width: 40px;">

                    <button class="btn btn-primary ms-2" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;" onclick="saveLabLimits(${lab.id})">
                        <i class="fas fa-save"></i>
                    </button>

                    <span id="labLimitSaveStatus-${lab.id}" class="ms-2"></span>
                </div>
                <div class="mb-2">
                    <strong>Instructors:</strong><br>
                    ${instructorBadges || '<span class="text-muted">No instructors assigned</span>'}
                </div>
                <div>
                    <strong>Assistants:</strong><br>
                    ${assistantBadges || '<span class="text-muted">No assistants assigned</span>'}
                </div>
            </div>
        `;loadLabLimits(lab.id);container.appendChild(labCard);});}
function loadLabLimits(labId){fetch(`api/save/?lab_id=${labId}`).then(response=>response.json()).then(data=>{document.getElementById(`labDimension-${labId}`).value=data.dimension||'0x0';document.getElementById(`labCapacity-${labId}`).value=data.capacity||'0';}).catch(error=>{console.error('Failed to load:',error);});}
function saveLabLimits(labId){const dimension=document.getElementById(`labDimension-${labId}`).value;const capacity=parseInt(document.getElementById(`labCapacity-${labId}`).value);fetch('api/save/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lab_id:labId,dimension:dimension,capacity:capacity})}).then(response=>response.json()).then(result=>{const status=document.getElementById(`labLimitSaveStatus-${labId}`);if(result.success){status.textContent='Saved!';status.classList.add('text-success');}else{status.textContent='Error: '+(result.error||'Unknown error');status.classList.add('text-danger');}}).catch(error=>{console.error('Save error:',error);});}
function updateBreadcrumb(items){const breadcrumb=document.getElementById('breadcrumb');breadcrumb.innerHTML='';items.forEach((item,index)=>{const li=document.createElement('li');li.className='breadcrumb-item';if(index===items.length-1){li.className+=' active';li.textContent=item;}else{li.innerHTML=`<a href="#" onclick="handleBreadcrumbClick(${index})">${item}</a>`;}
breadcrumb.appendChild(li);});}
function handleBreadcrumbClick(index){if(index===0){currentBuilding=null;currentFloor=null;loadBuildings();updateBreadcrumb(['Buildings']);}else if(index===1&&currentBuilding){currentFloor=null;selectBuilding(currentBuilding.id,currentBuilding.name);}}
function openAssignStaff(labId,labName){document.getElementById('assignLabId').value=labId;document.getElementById('assignStaffModalTitle').textContent=`Assign Staff to ${labName}`;loadAvailableStaff();const modal=new bootstrap.Modal(document.getElementById('assignStaffModal'));modal.show();}
function loadAvailableStaff(){fetch('/userprivileges/api/available-instructors/').then(response=>response.json()).then(data=>{displayAvailableStaff(data,'availableInstructors','instructor');}).catch(error=>{console.error('Error loading instructors:',error);displayAvailableStaff([{id:5,username:'prof_wilson',email:'prof@example.com',current_labs:2},{id:6,username:'dr_jones',email:'jones@example.com',current_labs:1}],'availableInstructors','instructor');});fetch('/userprivileges/api/available-assistants/').then(response=>response.json()).then(data=>{displayAvailableStaff(data,'availableAssistants','assistant');}).catch(error=>{console.error('Error loading assistants:',error);displayAvailableStaff([{id:7,username:'assistant1',email:'assist1@example.com',current_labs:3},{id:8,username:'assistant2',email:'assist2@example.com',current_labs:1}],'availableAssistants','assistant');});}
function displayAvailableStaff(staff,containerId,type){const container=document.getElementById(containerId);container.innerHTML='';const limit=type==='instructor'?instructorLimit:assistantLimit;staff.forEach(person=>{const canAssign=person.current_labs<limit;const staffItem=document.createElement('div');staffItem.className='staff-item';staffItem.innerHTML=`
            <div>
                <strong>${person.username}</strong><br>
                <small class="text-muted">${person.email}</small><br>
                <small class="text-info">Current labs: ${person.current_labs}/${limit}</small>
            </div>
            <button class="btn btn-sm btn-${canAssign ? 'success' : 'secondary'}" 
                    onclick="assignStaff(${person.id}, '${type}')" 
                    ${canAssign ? '' : 'disabled'}>
                ${canAssign ? 'Assign' : 'Limit Reached'}
            </button>
        `;container.appendChild(staffItem);});}
function assignStaff(userId,type){const labId=document.getElementById('assignLabId').value;fetch('/userprivileges/api/assign-staff/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':getCookie('csrftoken')},body:JSON.stringify({lab_id:labId,user_id:userId,type:type})}).then(response=>response.json()).then(data=>{if(data.success){showAlert('Staff assigned successfully!','success');loadStats();loadAvailableStaff();if(currentFloor){selectFloor(currentFloor.id,currentFloor.name);}}else{showAlert(data.error||'Error assigning staff','danger');}}).catch(error=>{console.error('Error assigning staff:',error);showAlert('Error assigning staff','danger');});}
function removeStaff(labId,userId,type){fetch('/userprivileges/api/remove-staff/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':getCookie('csrftoken')},body:JSON.stringify({lab_id:labId,user_id:userId,type:type})}).then(response=>response.json()).then(data=>{if(data.success){showAlert('Staff removed successfully!','success');loadStats();loadAvailableStaff();if(currentFloor){selectFloor(currentFloor.id,currentFloor.name);}}else{showAlert(data.error||'Error removing staff','danger');}});}
function loadAllUsers(){fetch('/userprivileges/api/users/').then(response=>response.json()).then(data=>{displayUsers(data);}).catch(error=>{console.error('Error loading users:',error);});}
function displayUsers(users){const tbody=document.getElementById('usersTableBody');tbody.innerHTML='';users.forEach(user=>{const row=document.createElement('tr');row.innerHTML=`
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>
                <span class="badge bg-${getRoleBadgeColor(user.role)}">${user.role}</span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary me-1" onclick="editUser(${user.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;tbody.appendChild(row);});}
function getRoleBadgeColor(role){switch(role){case'Administrator':return'primary';case'Lab Incharge':return'success';case'Lab Assistant':return'info';case'Students':return'secondary';case'No Roles':return'warning';default:return'secondary';}}
function filterUsers(searchTerm){const rows=document.querySelectorAll('#usersTableBody tr');rows.forEach(row=>{const text=row.textContent.toLowerCase();row.style.display=text.includes(searchTerm.toLowerCase())?'':'none';});}
function editUser(userId){fetch(`/userprivileges/api/users/${userId}/`).then(response=>response.json()).then(data=>{document.getElementById('editUserId').value=data.id;document.getElementById('editUsername').value=data.username;document.getElementById('editEmail').value=data.email;document.getElementById('editRole').value=data.role;const modal=new bootstrap.Modal(document.getElementById('editUserModal'));modal.show();}).catch(error=>{console.error('Error loading user:',error);showAlert('Error loading user data','danger');});}
function saveUser(){const userId=document.getElementById('editUserId').value;const userData={username:document.getElementById('editUsername').value,email:document.getElementById('editEmail').value,role:document.getElementById('editRole').value};fetch(`/userprivileges/api/users/${userId}/`,{method:'PUT',headers:{'Content-Type':'application/json','X-CSRFToken':getCookie('csrftoken')},body:JSON.stringify(userData)}).then(response=>response.json()).then(data=>{if(data.success){showAlert('User updated successfully!','success');bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();loadAllUsers();loadStats();}else{showAlert(data.error||'Error updating user','danger');}}).catch(error=>{console.error('Error updating user:',error);showAlert('Error updating user','danger');});}
function deleteUser(userId){if(confirm('Are you sure you want to delete this user?')){fetch(`/userprivileges/api/users/${userId}/`,{method:'DELETE',headers:{'X-CSRFToken':getCookie('csrftoken')}}).then(response=>response.json()).then(data=>{if(data.success){showAlert('User deleted successfully!','success');loadAllUsers();loadStats();}else{showAlert(data.error||'Error deleting user','danger');}}).catch(error=>{console.error('Error deleting user:',error);showAlert('Error deleting user','danger');});}}
function saveSettings(){instructorLimit=parseInt(document.getElementById('instructorLimit').value);assistantLimit=parseInt(document.getElementById('assistantLimit').value);fetch('/userprivileges/api/settings/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':getCookie('csrftoken')},body:JSON.stringify({instructor_limit:instructorLimit,assistant_limit:assistantLimit})}).then(response=>response.json()).then(data=>{if(data.success){showAlert('Settings saved successfully!','success');}else{showAlert(data.error||'Error saving settings','danger');}}).catch(error=>{console.error('Error saving settings:',error);showAlert('Error saving settings','danger');});}
function showAlert(message,type){const alertDiv=document.createElement('div');alertDiv.className=`alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;alertDiv.style.zIndex='9999';alertDiv.innerHTML=`
            <strong>${type === 'success' ? 'Success!' : 'Error!'}</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;document.body.appendChild(alertDiv);setTimeout(()=>{alertDiv.classList.remove('show');setTimeout(()=>alertDiv.remove(),150);},3000);}
function getCookie(name){let cookieValue=null;if(document.cookie&&document.cookie!==''){const cookies=document.cookie.split(';');for(let i=0;i<cookies.length;i++){const cookie=cookies[i].trim();if(cookie.substring(0,name.length+1)===(name+'=')){cookieValue=decodeURIComponent(cookie.substring(name.length+1));break;}}}
return cookieValue;};