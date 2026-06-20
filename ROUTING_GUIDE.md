# Frontend Routes Configuration Guide

## Overview
This document provides guidance on setting up React Router configuration for the upgraded authentication system.

---

## 📍 Recommended Route Structure

```jsx
// App.jsx or main routing file
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Public Components
import StudentLogin from "./components/StudentLogin";
import StudentSignup from "./components/StudentSignup";
import SupervisorLogin from "./components/Supervisor_Auth/Login";
import SupervisorSignup from "./components/SupervisorSignup";

// Protected Components
import StudentDashboard from "./components/Dashboard";
import SupervisorDashboard from "./components/Supervisor_Auth/Dashboard";
import AdminDashboard from "./components/Admin/AdminMain";

// Authentication Utilities
import ProtectedRoute from "./utils/ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/student/login" />} />
        
        {/* Student Routes */}
        <Route path="/student/login" element={<StudentLogin />} />
        <Route path="/student/signup" element={<StudentSignup />} />
        <Route 
          path="/student/dashboard" 
          element={
            <ProtectedRoute role="student">
              <StudentDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Supervisor Routes */}
        <Route path="/supervisor/login" element={<SupervisorLogin />} />
        <Route path="/supervisor/signup" element={<SupervisorSignup />} />
        <Route 
          path="/supervisor/dashboard" 
          element={
            <ProtectedRoute role="supervisor">
              <SupervisorDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route 
          path="/admin/dashboard" 
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />

        {/* 404 Not Found */}
        <Route path="*" element={<Navigate to="/student/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
```

---

## 🛡️ Protected Route Component

Create `src/utils/ProtectedRoute.jsx`:

```javascript
import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, role }) => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  // Check if token exists
  if (!token) {
    return <Navigate to={`/${role}/login`} replace />;
  }

  // Optional: Verify token is still valid (you could decode it here)
  // For now, we trust the token from localStorage

  // Render protected component
  return children;
};

export default ProtectedRoute;
```

---

## 🔄 Authentication Context (Optional but Recommended)

Create `src/context/AuthContext.jsx`:

```javascript
import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      
      // Determine role based on user data or login history
      const userRole = localStorage.getItem("userRole");
      setRole(userRole);
    }

    setLoading(false);
  }, []);

  const login = (userData, token, userRole) => {
    setUser(userData);
    setToken(token);
    setRole(userRole);
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("userRole", userRole);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setRole(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");
    localStorage.removeItem("supervisorData");
  };

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      role,
      loading,
      login,
      logout,
      isAuthenticated
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
```

---

## 🎯 Enhanced Protected Route with Context

Update `src/utils/ProtectedRoute.jsx` to use AuthContext:

```javascript
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, role }) => {
  const { token, user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or show a spinner component
  }

  if (!isAuthenticated) {
    return <Navigate to={`/${role}/login`} replace />;
  }

  // Optional: Role-based access control
  // if (role && user.role !== role) {
  //   return <Navigate to="/" replace />;
  // }

  return children;
};

export default ProtectedRoute;
```

---

## 📦 Updated App.jsx with Context

```javascript
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

// Components
import StudentLogin from "./components/StudentLogin";
import StudentSignup from "./components/StudentSignup";
// ... other imports

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/student/login" />} />
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/student/signup" element={<StudentSignup />} />

          {/* Protected Routes */}
          <Route 
            path="/student/dashboard" 
            element={
              <ProtectedRoute role="student">
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />

          {/* ... More routes */}

          <Route path="*" element={<Navigate to="/student/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

---

## 🔗 Integration with Login Components

Update your login component to use the AuthContext:

```javascript
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const StudentLogin = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const responseData = await response.json();

      if (response.ok) {
        // Use context instead of localStorage directly
        login(responseData.user, responseData.token, "student");
        navigate("/student/dashboard");
      } else {
        setError(responseData.message);
      }
    } catch (error) {
      setError(error.message);
    }
  };

  // ... rest of component
};
```

---

## 🧭 Navigation Utility

Create `src/utils/navigationUtils.js`:

```javascript
/**
 * Get dashboard URL based on user role
 */
export const getDashboardURL = (role) => {
  const dashboardMap = {
    student: "/student/dashboard",
    supervisor: "/supervisor/dashboard",
    admin: "/admin/dashboard"
  };
  return dashboardMap[role] || "/student/login";
};

/**
 * Get login URL based on role
 */
export const getLoginURL = (role) => {
  const loginMap = {
    student: "/student/login",
    supervisor: "/supervisor/login",
    admin: "/admin/login"
  };
  return loginMap[role] || "/student/login";
};

/**
 * Get signup URL based on role
 */
export const getSignupURL = (role) => {
  const signupMap = {
    student: "/student/signup",
    supervisor: "/supervisor/signup"
  };
  return signupMap[role] || "/student/signup";
};

/**
 * Determine role from component or URL
 */
export const determineRole = (pathname) => {
  if (pathname.includes("/student")) return "student";
  if (pathname.includes("/supervisor")) return "supervisor";
  if (pathname.includes("/admin")) return "admin";
  return null;
};
```

---

## 📋 Route Protection Checklist

- [ ] Token validation on app load
- [ ] Redirect unauthenticated users to login
- [ ] Role-based route protection implemented
- [ ] Logout clears localStorage
- [ ] Navigation guards prevent unauthorized access
- [ ] 404 handling in place
- [ ] Loading states shown while verifying auth

---

## 🔄 Handling Token Expiration

Add this to your API utility or fetch interceptor:

```javascript
/**
 * Create authenticated fetch request
 */
export const authenticatedFetch = async (url, options = {}) => {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Handle token expiration
  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/student/login";
  }

  return response;
};
```

---

## 🌐 Environment Variables

Create `.env` in frontend root:

```env
REACT_APP_API_URL=http://127.0.0.1:8000/auth
REACT_APP_JWT_EXPIRY=86400
```

---

## 📱 Complete Route Map

```
Public Routes:
├── /student/login       → StudentLogin
├── /student/signup      → StudentSignup
├── /supervisor/login    → SupervisorLogin
├── /supervisor/signup   → SupervisorSignup
└── /admin/login         → AdminLogin

Protected Routes:
├── /student/dashboard   → StudentDashboard (role: student)
├── /student/*           → Student modules
├── /supervisor/dashboard → SupervisorDashboard (role: supervisor)
├── /supervisor/*        → Supervisor modules
├── /admin/dashboard     → AdminDashboard (role: admin)
└── /admin/*             → Admin modules

Catch-all:
└── *                    → Redirect to /student/login
```

---

## ✅ Testing Routes

```javascript
// Test protected route access
const testProtectedRoute = () => {
  // 1. Clear localStorage
  localStorage.clear();

  // 2. Try to access /student/dashboard
  // Expected: Redirect to /student/login

  // 3. Login with valid credentials
  // Expected: Redirect to /student/dashboard

  // 4. Logout
  // Expected: Redirect to /student/login
};
```

---

**Last Updated**: 2026-06-13
**Version**: 1.0
