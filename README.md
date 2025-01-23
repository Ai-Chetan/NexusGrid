<!DOCTYPE html>
<html>
    <body>
        <h1>NexusGrid - System Monitoring and Management System</h1>
        <p>NexusGrid is an advanced system monitoring and management platform designed to streamline the administration of computer systems across departments. It ensures real-time fault detection, resource optimization, and effective communication between Admins, Instructors, and Users.</p>
        <h2>Key Features</h2>
        <ul>
            <li>User Roles and Responsibilities
        <ul>
            <li>Admin: Centralized control, fault management, user delegation, and strategic decision-making.</li>
            <li>Instructor: Fault reporting, resource requests, and group-specific monitoring.</li>
            <li>User (Optional): Fault notification, resource requests, and usage tracking.</li>
        </ul>
        </li>
            <li>Dashboards
        <ul>
            <li>Admin Dashboard: Comprehensive metrics, graphical insights, and recent activities.</li>
            <li>Instructor Dashboard: Group-specific overviews, quick actions, and history logs.</li>
            <li>User Dashboard (Optional): Real-time fault status and request tracking.</li>
        </ul>
        </li>
            <li>Real-Time System Monitoring</li>
        <ul>
            li>Automated health checks for CPU, memory, network, and device drivers.</li>
            <li>Visual system layouts with interactive maps (using Folium and Plotly).</li>
        </ul>
        </li>
            <li>Notifications</li>
        <ul>
            <li>Fault reporting alerts, repair updates, and automated email notifications.</li>
        </ul>
        </li>
            <li>Bulk Software Management</li>
        <ul>
            <li>Automate software deployment, updates, and uninstallation using tools like Ansible or Fabric.</li>
        </ul>
        </li>
            <li>Energy Management</li>
        <ul>
            <li>Monitor power consumption, automate shutdowns, and generate energy-saving reports.</li>
        </ul>
        </li>
            <li>Report Generation</li>
        <ul>
            <li>Export fault statistics, maintenance logs, and performance data in formats like PDF and CSV.</li>
        </ul>
        </li>
        </ul>
            <h2>Technology Stack</h2>
            <h3>Libraries and Tools</h3>
        <ul>
            <li>Web Frameworks: Flask / Django</li>
            <li>Real-Time Communication: Flask-SocketIO / Django Channels</li>
            <li>Data Visualization: Plotly, Matplotlib, Seaborn</li>
            <li>System Monitoring: psutil, pySMART, pynvml</li>
            <li>Task Management: Celery</li>
            <li>Database Management: SQLite, MySQL, PostgreSQL</li>
            <li>Automation: Ansible, Fabric</li>
        </ul>
            <h3>Additional Features</h3>
        <ul>
            <li>Interactive Layouts: Folium and Plotly for system mapping.</li>
            <li>QR Code Functionality: Generate and scan QR codes for quick fault reporting and system details.</li>
            <li>Analytics: Usage patterns and trends with Pandas and Scikit-learn.</li>
        </ul>
        <h2>Installation</h2>
        <ol>
        <li><strong>Clone the repository:</strong>
            <pre><code>
            git clone https://github.com/username/nexusgrid.git
            cd nexusgrid
            </code></pre>
        </li>
        <li><strong>Create a virtual environment (recommended):</strong>
            <pre><code>
            python3 -m venv venv 
            source venv/bin/activate 
            </code></pre>
        </li>
        <li><strong>Install dependencies:</strong>
            <pre><code>
            pip install -r requirements.txt
            </code></pre>
        </li>
        <li><strong>Configure the database (if using a database other than SQLite):</strong>
            <p>Update the database connection settings in your project's settings file.</p>
        </li>
        <li><strong>Run migrations:</strong>
            <pre><code>
            python manage.py migrate 
            </code></pre>
        </li>
        <li><strong>Start the development server:</strong>
            <pre><code>
            python manage.py runserver
            </code></pre>
        </li>
        </ol>
    </body>
</html>