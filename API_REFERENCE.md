# Authentication API Reference

## Base URL
```
http://127.0.0.1:8000/auth
```

## 🔐 Student Authentication

### Student Signup
**POST** `/student/signup`

Request Body:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "studentJoinCode": "CS-STU-4WKL"
}
```

Success Response (201):
```json
{
  "message": "Student registered successfully",
  "success": true,
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "department": "Computer Science"
  }
}
```

Error Response (400):
```json
{
  "message": "Invalid or expired student join code.",
  "success": false
}
```

---

### Student Login
**POST** `/login`

Request Body:
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

Success Response (200):
```json
{
  "message": "Login successfully ;)",
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "department": "Computer Science"
  }
}
```

Error Response (403):
```json
{
  "message": "Authentication failed! email or password is wrong.",
  "success": false
}
```

---

### Verify Student Join Code
**POST** `/verify-student-join-code`

Request Body:
```json
{
  "joinCode": "CS-STU-4WKL"
}
```

Success Response (200):
```json
{
  "message": "Join code verified successfully.",
  "department": {
    "_id": "dept_id",
    "name": "Computer Science",
    "code": "CS",
    "academicSession": "Spring 2026"
  }
}
```

Error Response (404):
```json
{
  "message": "Invalid or expired student join code."
}
```

---

## 👨‍🏫 Supervisor Authentication

### Supervisor Signup
**POST** `/supervisor/signup`

Request Body:
```json
{
  "name": "Dr. Jane Smith",
  "email": "jane@example.com",
  "password": "password123",
  "phone": "+1234567890",
  "supervisorJoinCode": "CS-SUP-8JQ2"
}
```

Success Response (201):
```json
{
  "success": true,
  "message": "Supervisor registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "supervisor_id",
    "name": "Dr. Jane Smith",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "department": "Computer Science",
    "designation": "Supervisor",
    "status": "Active",
    "createdAt": "2026-06-13T10:00:00Z"
  }
}
```

Error Response (400):
```json
{
  "success": false,
  "message": "Invalid or expired supervisor join code."
}
```

---

### Supervisor Login
**POST** `/supervisor/login`

Request Body:
```json
{
  "email": "jane@example.com",
  "password": "password123"
}
```

Success Response (200):
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "supervisor_id",
    "name": "Dr. Jane Smith",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "department": "Computer Science",
    "designation": "Supervisor",
    "status": "Active",
    "createdAt": "2026-06-13T10:00:00Z"
  }
}
```

---

### Verify Supervisor Join Code
**POST** `/verify-supervisor-join-code`

Request Body:
```json
{
  "joinCode": "CS-SUP-8JQ2"
}
```

Success Response (200):
```json
{
  "message": "Join code verified successfully.",
  "department": {
    "_id": "dept_id",
    "name": "Computer Science",
    "code": "CS",
    "academicSession": "Spring 2026"
  }
}
```

---

## 🏛️ Department Management (Admin Only)

### Create Department
**POST** `/admin/department`

Request Body:
```json
{
  "name": "Computer Science",
  "code": "CS",
  "academicSession": "Spring 2026",
  "description": "Computer Science Department"
}
```

Success Response (201):
```json
{
  "message": "Department created successfully.",
  "department": {
    "_id": "dept_id",
    "name": "Computer Science",
    "code": "CS",
    "academicSession": "Spring 2026",
    "studentJoinCode": "CS-STU-4WKL",
    "supervisorJoinCode": "CS-SUP-8JQ2",
    "totalStudents": 0,
    "totalSupervisors": 0,
    "isActive": true
  }
}
```

---

### Get All Departments
**GET** `/admin/department`

Success Response (200):
```json
{
  "message": "Departments fetched successfully.",
  "departments": [
    {
      "_id": "dept_id_1",
      "name": "Computer Science",
      "code": "CS",
      "academicSession": "Spring 2026",
      "totalStudents": 45,
      "totalSupervisors": 3,
      "isActive": true
    },
    {
      "_id": "dept_id_2",
      "name": "Mathematics",
      "code": "MATH",
      "academicSession": "Spring 2026",
      "totalStudents": 38,
      "totalSupervisors": 2,
      "isActive": true
    }
  ]
}
```

---

### Get Department by ID
**GET** `/admin/department/:id`

Success Response (200):
```json
{
  "message": "Department fetched successfully.",
  "department": {
    "_id": "dept_id",
    "name": "Computer Science",
    "code": "CS",
    "academicSession": "Spring 2026",
    "studentJoinCode": "CS-STU-4WKL",
    "supervisorJoinCode": "CS-SUP-8JQ2",
    "totalStudents": 45,
    "totalSupervisors": 3,
    "isActive": true
  }
}
```

---

### Update Department
**PUT** `/admin/department/:id`

Request Body:
```json
{
  "name": "Computer Science & Engineering",
  "academicSession": "Fall 2026",
  "isActive": true
}
```

Success Response (200):
```json
{
  "message": "Department updated successfully.",
  "department": { ... }
}
```

---

### Delete Department
**DELETE** `/admin/department/:id`

Success Response (200):
```json
{
  "message": "Department deleted successfully."
}
```

---

### Regenerate Student Join Code
**POST** `/admin/department/:id/regenerate-student-code`

Success Response (200):
```json
{
  "message": "Student join code regenerated successfully.",
  "department": {
    "studentJoinCode": "CS-STU-7XYZ"
  }
}
```

---

### Regenerate Supervisor Join Code
**POST** `/admin/department/:id/regenerate-supervisor-code`

Success Response (200):
```json
{
  "message": "Supervisor join code regenerated successfully.",
  "department": {
    "supervisorJoinCode": "CS-SUP-5ABC"
  }
}
```

---

### Get Department Statistics
**GET** `/admin/department/:id/stats`

Success Response (200):
```json
{
  "message": "Department statistics fetched successfully.",
  "stats": {
    "totalStudents": 45,
    "totalSupervisors": 3,
    "totalTeams": 12,
    "totalProjects": 24,
    "academicSession": "Spring 2026"
  }
}
```

---

## 🔑 Authentication Headers

All protected routes require:
```
Authorization: Bearer <JWT_TOKEN>
```

Example:
```
GET /protected-route HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJfaWQiOiI1ZTkwZDVjYjljYjY2NDAwMDg0ZWI5OGMiLCJpYXQiOjE1ODY4NDkxNTUsImV4cCI6MTU4Njc2Mjc1NX0.d4s7k3j4k2h5j2k3j4k5j6k7j8k9
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input or missing fields |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Authentication failed or access denied |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Duplicate email or join code |
| 500 | Server Error - Internal server error |

---

## Common Error Responses

### Missing Required Field
```json
{
  "message": "All fields are required.",
  "success": false
}
```

### Duplicate Email
```json
{
  "message": "User already exists",
  "success": false
}
```

### Invalid Token
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

### Access Denied (Role-based)
```json
{
  "success": false,
  "message": "Access denied. Allowed roles: student, supervisor"
}
```

---

## Frontend Integration Examples

### Using Student Login
```javascript
const handleStudentLogin = async (email, password) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  if (data.success) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    // Redirect to dashboard
  }
};
```

### Using Protected Route
```javascript
const fetchProtectedData = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/protected-route`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  // Handle response
};
```

---

**Last Updated**: 2026-06-13
**API Version**: 1.0
