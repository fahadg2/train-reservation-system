# Train Schedule and Reservation Management System

A centralized web-based platform for managing train schedules, passenger reservations, and ticket allocation. Built as part of the **CS1350 – Software Engineering 1** course at **Imam Mohammad Ibn Saud Islamic University (IMSIU)**.

---

## Project Overview

The Train Schedule and Reservation Management System is designed to provide an efficient platform for managing train schedules and passenger reservations. Administrators can set up routes, define stops, and adjust timings without juggling spreadsheets or paperwork. On the passenger side, finding a train and booking a ticket is fast and straightforward.

By automating these processes, the system reduces errors, speeds up operations, and provides management with clean data for smarter decision-making.

---

## Key Features

-  **Secure Authentication** — Role-based login for Admins, Booking Staff, and Managers
-  **Train & Schedule Management** — Create, update, and delete train routes, timings, and stops
-  **Seat Management** — Automatic seat availability checks to prevent double bookings
-  **Reservation Module** — Book, modify, and cancel tickets with real-time updates
-  **Passenger Profiles** — Maintain passenger details and booking history
-  **Admin Dashboard** — Track bookings, revenue, and occupancy rates
-  **Reports & Analytics** — Generate daily, weekly, and monthly performance reports
-  **Data Backup & Recovery** — Built-in safeguards for data integrity

---

## System Architecture

The system follows a **Layered (N-Tier) Architecture** for modularity, scalability, and maintainability:

| Layer | Responsibility |
|-------|----------------|
| **Presentation Layer** | User interfaces for Admins, Booking Staff, and Managers |
| **Business Logic Layer** | Schedule Manager, Reservation Engine, Role Manager, Report Generator |
| **Data Access Layer** | Abstracts database operations via DAOs |
| **Database Layer** | Persistent storage for schedules, passengers, reservations, and logs |

---

## Technologies Used

- **Frontend:** HTML, CSS, JavaScript
- **Supabase** For Backend and Database
- **Version Control:** Git & GitHub

---

## Project Structure

```
train-schedule-reservation-system/
│
├── docs/                  # Documentation (Phase 1, 2, 3 reports)
├── src/                   # Source code
│   ├── frontend/          # UI files
├── supabase/
│   ├── migration/
├── scrum/                 # Excel Scrum sheets and Product Backlog
├── presentation/          # Final PowerPoint presentation
└── README.md
```

---

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/train-schedule-reservation-system.git

# Navigate into the project
cd train-schedule-reservation-system

# Install dependencies
[your install command]

# Run the project
[your run command]
```

---

## Development Phases

The project followed the **Agile Scrum** methodology across three sprints:

- **Phase 1 (Sprint #1):** Project setup, scope definition, and Product Backlog
- **Phase 2 (Sprint #2):** System design, UML modeling, and initial implementation
- **Phase 3 (Sprint #3):** Full feature implementation, testing, and deployment

---

## Team Members

| Name | Student ID |
|------|------------|
| Abdullah Waleed bin Maneea | 446002316 |
| Abdullah Yousef AlDhayan   | 446001181 |
| Abdullah Ibrahim AlOud     | 446000469 |
| Fahad Ali Alghubayshi      | 446004023 |

---

## Course Information

- **Course:** CS1350 – Software Engineering 1
- **Section:** 173
- **Instructor:** Prof. Gufran Ahmed Ansari
- **University:** Imam Mohammad Ibn Saud Islamic University (IMSIU)
- **College:** College of Computer and Information Sciences
- **Semester:** Second Semester, 2026

---

## License

This project is developed for academic purposes as part of the CS1350 course at IMSIU.

---

## Acknowledgments

Special thanks to **Prof. Gufran Ahmed Ansari** for guidance throughout the project.
