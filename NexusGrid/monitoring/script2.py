import requests
from script import get_system_info


api_url = "http://127.0.0.1:8000/api/system-info/"
system_info = get_system_info()  # Your function to get system info

response = requests.post(api_url, json=system_info)

print("Response Status Code:", response.status_code)
print("Response Data:", response.json())
