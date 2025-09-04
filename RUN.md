# How to Run FlowChat

This file provides quick commands to run the frontend and backend servers for the FlowChat application, assuming you have already completed the initial setup (installing dependencies, etc.).

---

## Backend (Django)

**First-Time Setup (Run Once)**

If you haven't set up the backend environment yet, run these commands first:

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create the Python virtual environment:**
    ```bash
    py -3.12 -m venv venv
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

---

**Running the Server**

1.  **Navigate to the backend directory (if not already there):**
    ```bash
    cd backend
    ```

2.  **Activate the virtual environment:**
    ```bash
    # On Windows (Command Prompt):
    .\venv\Scripts\activate

    # On Windows (PowerShell):
    .\venv\Scripts\Activate.ps1

    # On macOS/Linux:
    source venv/bin/activate
    ```

3.  **Start the Django server:**
    ```bash
    python manage.py runserver
    ```
    The backend will be running at `http://127.0.0.1:8000`.

---

## Frontend (React)

1.  **Navigate to the frontend directory in a separate terminal:**
    ```bash
    cd frontend
    ```

2.  **Start the React development server:**
    ```bash
    npm start
    ```
    The frontend will open automatically at `http://localhost:3000`.
