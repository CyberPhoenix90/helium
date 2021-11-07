import * as express from 'express';

const app = express();

app.post('/helium/helium_test_client/MyService/reportMetric', (req, res) => {});

app.listen(3000, () => {
	console.log('listening on port 3000');
});
