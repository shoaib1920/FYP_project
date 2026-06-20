import { Route, Routes, Navigate } from "react-router-dom";
import Main from "./components/Main";
import StudentSignup from "./components/StudentSignup";
import Login from "./components/Login";
import CreateTask from "./components/CreateTask";
import AssignTask from "./components/AssignTask";
import SupervisorSignup from "./components/SupervisorSignup";
import SupervisorLogin from "./components/Supervisor_Auth/Login";
import SupervisorMain from "./components/Supervisor_Auth/Main";
import ManageTeams from "./components/Teams";
import AdminLogin from "./components/Admin/AdminAuth/login/AdminLogin";
import AdminSignup from "./components/Admin/AdminAuth/Signup/AdminSignup";
import AdminMain from "./components/Admin/AdminMain";
import RoleSelector from "./components/RoleSelector";
import StudentProposal from "./components/StudentProposal";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import VerifyEmail from "./components/VerifyEmail";



function App() {
	const user = localStorage.getItem("token");
  const adminUser=localStorage.getItem("adminToken");

	return (

		<Routes>


       <Route
    path="/"
    element={<RoleSelector /> }
  />
  {/* Protected Route */}
  <Route 
      path= "/admin/dashboard"
      element={adminUser ? <AdminMain /> : <Navigate to="/admin/login" replace />}
      />


  <Route
    path="/student/Dashboard"
    element={user ? <Main /> : <Navigate to="/student/login" replace />}
  />
 
<Route
    path="/admin/signup"
    element={<AdminSignup /> }
  />

<Route
    path="/admin/login"
    element={<AdminLogin />}
  />

  <Route
    path="/admin/forgot-password"
    element={<ForgotPassword role="admin" loginPath="/admin/login" />}
  />
  <Route
    path="/admin/reset-password/:token"
    element={<ResetPassword role="admin" loginPath="/admin/login" />}
  />
  <Route
    path="/admin/verify-email/:token"
    element={<VerifyEmail role="admin" loginPath="/admin/login" />}
  />



  <Route
    path="/supervisor/signup"
    element={<SupervisorSignup/>} />
  <Route
  path="/supervisor/login"
    element={<SupervisorLogin/>} />
  <Route
    path="/supervisor/forgot-password"
    element={<ForgotPassword role="supervisor" loginPath="/supervisor/login" />}
  />
  <Route
    path="/supervisor/reset-password/:token"
    element={<ResetPassword role="supervisor" loginPath="/supervisor/login" />}
  />
  <Route
    path="/supervisor/verify-email/:token"
    element={<VerifyEmail role="supervisor" loginPath="/supervisor/login" />}
  />
  <Route path="/supervisor/dashboard" element={<SupervisorMain defaultModule="Dashboard" />} />

  {/* <Route path="/ManageTeams" element={<ManageTeams defaultModule="Dashboard" />} /> */}


  {/* Public Routes */}
  <Route path="/student/chat/:chatId" element={<Main defaultModule="ChatBox" />}  />
  <Route path="/student/signup" element={<StudentSignup />} />
  <Route path="/student/login" element={<Login />} />
  <Route
    path="/student/forgot-password"
    element={<ForgotPassword role="student" loginPath="/student/login" />}
  />
  <Route
    path="/student/reset-password/:token"
    element={<ResetPassword role="student" loginPath="/student/login" />}
  />
  <Route
    path="/student/verify-email/:token"
    element={<VerifyEmail role="student" loginPath="/student/login" />}
  />
  <Route path="/student/my-tasks" element={<Main defaultModule="MyTasks" />} />
  <Route path="/student/create-tasks" element={<Main defaultModule="CreateTask" />} />
  <Route path="/student/Chats" element={<Main defaultModule="ChatBox" />} />
  <Route path="/student/Template-manager" element={<Main defaultModule="Template-manager" />} />
  <Route path="/student/Feedback"  element={<Main defaultModule="Feedback" />} />
  <Route path="/student/Dashboard"  element={<Main defaultModule="Dashboard" />} />
  <Route path="/student/Assign-task"  element={<Main defaultModule="AssignTask" />} />

  <Route path="/student/StudentProposal"  element={<Main defaultModule="StudentProposal" />} />

  {/* You can also protect /create-task if needed */}
  <Route
    path="/student/create-task"
    element={user ? <CreateTask /> : <Navigate to="/student/login" replace />}
  />
</Routes>


	);
}

export default App;
