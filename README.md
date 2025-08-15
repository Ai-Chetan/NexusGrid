# NexusGrid - System Monitoring and Management Platform

NexusGrid is a full-stack, automated system monitoring and control platform designed for **real-time health checks**, **fault reporting**, and **resource management** in academic institutions and corporate IT environments.  

It replaces outdated manual processes with an **interactive, role-based dashboard** for System Administrators, Operators / End-Users, and Technicians / IT Support Engineers, ensuring efficient management, reduced downtime, and improved operational efficiency.

---

## ✨ Features

- **Real-Time System Monitoring** – Continuous health tracking using Python libraries like `psutil` and `pySMART`.  
- **QR Code Fault Reporting** – Scan workspace-specific QR codes for instant issue logging.  
- **Role-Based Dashboards** – Tailored access and tools for Admin, Manager, and Employee roles.  
- **Interactive Workspace Layouts** – Built using PyGame for visual asset mapping.  
- **Energy Management** – Automatic control of idle systems to save power.  
- **Analytics & Reporting** – Visual insights powered by Plotly and Matplotlib.  
- **Secure Authentication** – OTP verification, password rules, and multi-platform login support.  

---

## 🛠 Technology Stack

- **Backend:** Django (Python)  
- **Frontend:** HTML, CSS, Bootstrap, JavaScript  
- **System Monitoring:** psutil, pySMART  
- **Data Visualization:** Plotly  
- **Database:** PostgreSQL  

---

## 📊 Key Outcomes

- Reduced fault reporting time through QR code-based system identification.  
- Improved uptime with continuous monitoring and proactive alerts.  
- Secure and scalable system architecture with Django backend.  
- User-friendly, responsive interface that works across devices.  

---

## 🚀 Future Roadmap

Planned enhancements include:

1. **Predictive Analytics & Machine Learning** – Detect hardware failures before they occur.  
2. **Cloud-Native & Microservices** – Deploy modular services on Kubernetes/Docker Swarm.  
3. **Mobile & Voice Assistants** – Native apps and Alexa/Google Assistant integration.  
4. **IoT & SNMP Support** – Monitor routers, switches, and sensors in real-time.  
5. **Advanced Energy Optimization** – Integrate with building management systems.  
6. **Role-Based SLA Tracking** – Automatic uptime/downtime compliance reports.  
7. **Third-Party Integrations** – Slack, Teams, Jira, PagerDuty plugins.  
8. **Custom Dashboards** – Heat maps, geospatial mapping, and drill-down analytics.  

---

## 📌 Getting Started

### Prerequisites
- Python 3.9+  
- PostgreSQL  

### Installation
```bash
# Clone the repository
git clone https://github.com/ai-chetan/nexusgrid.git
cd nexusgrid

# Create and activate virtual environment
python -m venv venv

# On Linux/Mac
source venv/bin/activate
# On Windows
venv\Scripts\activate

# Install Django and other dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env
# (Edit .env with your settings)

# Setup database (SQLite by default) and run migrations
python manage.py migrate

# (Optional) Create a superuser account
python manage.py createsuperuser

# Start the development server
python manage.py runserver
```

---

## 👥 Contributors

- [**Chetan Chaudhari**](https://github.com/Ai-Chetan)
- [**Nischay Chavan**](https://github.com/Nischay-loq)
- [**Parth Shikhare**](https://github.com/ParthShikhare19)

---

## 📜 License
This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

---
