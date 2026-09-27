"""
Bulk-submits sample errors to the Regression Whisperer / REV dashboard
via Selenium, so the Analytics dashboard has realistic demo data.

Requirements:
    pip install selenium

Also requires a matching chromedriver (Selenium 4.6+ auto-manages this
via Selenium Manager, so a plain `pip install selenium` is usually enough).

USAGE:
    1. Fill in BASE_URL, EMAIL, PASSWORD below.
    2. Make sure the dashboard elements have the ids listed in the
       "Required element ids" comment (ask Bob to add them if missing).
    3. Run: python bulk_submit_errors.py
"""

import random
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# ---------------- CONFIG ----------------
BASE_URL = "http://localhost:3000"
EMAIL = "demo@ventech.com"
PASSWORD = "dc87eNc82QVPcQE"
NUM_SUBMISSIONS = 200
DELAY_BETWEEN_SUBMISSIONS_SECONDS = 7  # throttle to respect Gemini free-tier rate limits
# -----------------------------------------

# Required element ids on the page (ask Bob to add these if not present):
#   login-email, login-password, login-submit
#   submit-stacktrace, submit-description, submit-btn

SAMPLE_ERRORS = [
    ("TypeError: Cannot read properties of undefined (reading 'name')",
     "Tried to access user.name but user was undefined because the API call hadn't resolved yet"),
    ("TypeError: Cannot read properties of null (reading 'value')",
     "Form input ref was null because the component hadn't mounted when the handler ran"),
    ("ReferenceError: x is not defined",
     "Used a variable outside its scope, forgot to declare it with let/const"),
    ("RangeError: Maximum call stack size exceeded",
     "Recursive function was missing a base case, caused infinite recursion"),
    ("SyntaxError: Unexpected token '}'",
     "Extra closing brace left over after refactoring a function"),
    ("MongoNetworkError: connection timed out",
     "MongoDB Atlas IP whitelist didn't include the new deployment server's IP"),
    ("MongooseError: Operation `users.findOne()` buffering timed out",
     "Mongoose tried to query before the initial connection had been established"),
    ("JsonWebTokenError: invalid signature",
     "JWT_SECRET was different between the token-issuing server and the verifying server"),
    ("JsonWebTokenError: jwt expired",
     "Access token expired and there was no refresh flow to silently reissue one"),
    ("Error: ENOENT: no such file or directory, open 'config.json'",
     "Relative file path broke when the script was run from a different working directory"),
    ("Error: ECONNREFUSED 127.0.0.1:5432",
     "Postgres wasn't running locally when the app tried to connect on startup"),
    ("ValueError: invalid literal for int() with base 10",
     "Tried to parse a string that contained non-numeric characters as an integer"),
    ("KeyError: 'user_id'",
     "Dictionary was missing the expected key because an earlier API response format changed"),
    ("IndexError: list index out of range",
     "Looped one index too far past the end of a list after an off-by-one mistake"),
    ("AttributeError: 'NoneType' object has no attribute 'get'",
     "Function returned None on a certain code path instead of the expected dict"),
    ("ZeroDivisionError: division by zero",
     "Divided by a denominator that could legitimately be zero without a guard clause"),
    ("ECONNRESET: socket hang up",
     "Upstream service closed the connection mid-request during a slow network period"),
    ("ETIMEDOUT: connect ETIMEDOUT",
     "External API call had no timeout configured and hung until the OS killed it"),
    ("UnhandledPromiseRejectionWarning: Error: Invalid input",
     "An async function's rejected promise was never caught with .catch() or try/catch"),
    ("CastError: Cast to ObjectId failed for value \"undefined\"",
     "Tried to query MongoDB with an undefined id because a route param wasn't parsed correctly"),
]


def wait_and_find(driver, by, value, timeout=15):
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((by, value))
    )


def login(driver):
    driver.get(BASE_URL)
    email_field = wait_and_find(driver, By.ID, "login-email")
    password_field = driver.find_element(By.ID, "login-password")
    email_field.clear()
    email_field.send_keys(EMAIL)
    password_field.clear()
    password_field.send_keys(PASSWORD)
    driver.find_element(By.ID, "login-submit").click()
    # Wait for the dashboard to appear after login
    wait_and_find(driver, By.ID, "submit-stacktrace", timeout=15)
    print("Logged in successfully.")


def submit_one(driver, stack_trace, description):
    stacktrace_field = driver.find_element(By.ID, "submit-stacktrace")
    description_field = driver.find_element(By.ID, "submit-description")
    submit_btn = driver.find_element(By.ID, "submit-btn")

    stacktrace_field.clear()
    stacktrace_field.send_keys(stack_trace)
    description_field.clear()
    description_field.send_keys(description)
    submit_btn.click()

    # Give the Gemini call + save time to complete before the next submission
    time.sleep(DELAY_BETWEEN_SUBMISSIONS_SECONDS)


def main():
    driver = webdriver.Chrome()
    try:
        login(driver)

        for i in range(1, NUM_SUBMISSIONS + 1):
            stack_trace, description = random.choice(SAMPLE_ERRORS)
            print(f"[{i}/{NUM_SUBMISSIONS}] Submitting: {stack_trace[:50]}...")
            try:
                submit_one(driver, stack_trace, description)
            except Exception as e:
                print(f"  -> Failed: {e}. Retrying once after a short pause...")
                time.sleep(5)
                try:
                    submit_one(driver, stack_trace, description)
                except Exception as e2:
                    print(f"  -> Retry also failed, skipping: {e2}")

        print("Done submitting all samples.")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()