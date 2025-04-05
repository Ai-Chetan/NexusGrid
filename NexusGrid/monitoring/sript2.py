import requests

# URL of the Django API
API_URL = "http://127.0.0.1:8000/api/system-info/"

# Run your script and capture output
def get_script_output():
    output = "Hello, this is the script output!"
    return output

# Prepare data payload
data = {"output": get_script_output()}

# Send POST request
response = requests.post(API_URL, json=data)

# Print response from the server
print(response.status_code, response.json())
