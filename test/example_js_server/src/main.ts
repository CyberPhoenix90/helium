import * as bodyParser from 'body-parser';
import * as express from 'express';
import { BinaryReader } from 'helium_client_rt';
import { TestMessageFactory } from 'helium_test_server';
import { join } from 'path';

const app = express();
app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '2mb' }));

app.post('/helium/helium_test_client/MyService/reportMetric', (req, res) => {
    console.log(req.body);
    const msg = TestMessageFactory.fromBinary(new BinaryReader(new Uint8Array(req.body).buffer));
    console.dir(msg);
    res.send();
});

app.use(express.static(join(__dirname, '../../example_js_client')));

app.listen(3000, () => {
    console.log('listening on port 3000');
});
