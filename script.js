import http from 'k6/http';
// This will export to HTML as filename "result.html" AND also stdout using the text summary json=results.json
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";
import { check, sleep } from 'k6';

export const options ={
    vus: 50,
    duration: '3s'
}
  export default function () {
    const res =http.get('http://test.k6.io');
    check(res,{'Status was 200': r => r.status == 200});
    sleep(1);
  }

  export function handleSummary(data){
    return {
      'index.html': htmlReporter(data),
      stdout: textSummary(data, { indent: " ", enableColors: true }),
    }
  }