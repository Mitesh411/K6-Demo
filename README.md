# k6 Load Testing Project

This project uses k6 to perform load testing on a sample API. It includes a k6 script to define the test and an HTML report to visualize the test results.

## Files

*   **`script.js`**: This is a k6 load testing script. It defines a test that sends GET requests to `https://test-api.k6.io/public/crocodiles/`.
*   **`html-report.html`**: This is a static HTML page that provides a visual report of the k6 test results. The test data is embedded within the HTML file (gzipped and base64 encoded) and is processed client-side by JavaScript to render the charts and statistics.
*   **`.github/workflows/basic.yml`**: This file likely defines a GitHub Actions workflow, which could be used for continuous integration (CI) to automatically run the k6 tests on events like code pushes or pull requests.

## How to Use

### Running the k6 Script

1.  **Install k6:** If you don't have k6 installed, download and install it from the [official k6 website](https://k6.io/docs/getting-started/installation/).
2.  **Open your terminal or command prompt.**
3.  **Navigate to the project directory.**
4.  **Run the script:** Execute the following command:
    ```bash
    k6 run script.js
    ```

### Viewing the HTML Report

1.  **Open `html-report.html` in your web browser.**
    *   You can usually do this by double-clicking the file or right-clicking and selecting "Open with" your preferred browser.
    *   The report will load and display the test results.

## Interpreting the Report

The `html-report.html` provides a visual overview of the load test results. Key areas to focus on include:

*   **Summary Statistics:** Look for overall metrics like the total number of requests, requests per second (RPS), average response time, error rates, and percentile values (e.g., p90, p95, p99 response times).
*   **Graphs and Charts:**
    *   **Response Time Trends:** Observe how response times change over the duration of the test.
    *   **RPS Trends:** See how the actual request rate compares to the configured rate.
    *   **Error Rate Trends:** Identify if and when errors occurred during the test.
*   **Checks and Thresholds:** If your k6 script includes [Checks](https://k6.io/docs/using-k6/checks/) or [Thresholds](https://k6.io/docs/using-k6/thresholds/), the report will indicate whether these passed or failed. This helps in automatically verifying the performance against predefined criteria.

For a more detailed understanding of k6 results and metrics, refer to the [official k6 documentation](https://k6.io/docs/results-output/).

## Contributing

Contributions are welcome! If you have suggestions for improvements or find any issues, please feel free to:

1.  **Fork the repository.**
2.  **Create a new branch** for your feature or bug fix:
    ```bash
    git checkout -b feature/your-feature-name
    ```
3.  **Make your changes.**
4.  **Commit your changes:**
    ```bash
    git commit -m "Add your commit message here"
    ```
5.  **Push to the branch:**
    ```bash
    git push origin feature/your-feature-name
    ```
6.  **Open a Pull Request.**

Please ensure your code adheres to any existing styling and that tests (if applicable) are updated.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details (if a LICENSE file is present, otherwise, assume MIT).
