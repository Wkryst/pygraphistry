import expressApp from './app.js'
import bodyParser from 'body-parser';
import { simpleflake } from 'simpleflakes';

import { reloadHot } from '../shared/reloadHot';
import { renderMiddleware } from './middleware';
import { getDataSourceFactory } from '../shared/middleware';
import { dataSourceRoute as falcorMiddleware } from 'falcor-express';
import { app as createApp, pivot as createPivot, investigation as createInvestigation } from '../shared/models';
import { loadApp, loadInvestigations, loadPivots, loadRows, insertPivot,
         splicePivot, calcTotals, searchPivot, uploadGraph } from '../shared/services';

import PivotTemplates from '../shared/models/PivotTemplates';
import {
    ref as $ref,
    atom as $atom,
    pathValue as $pathValue,
    pathInvalidation as $invalidation
} from '@graphistry/falcor-json-graph';



const cols = [
    { name: 'Mode'},
    { name: 'Input' },
    { name: 'Search' },
    { name: 'Links' },
    { name: 'Time'}
];

const placeHolder = {
    'Search': 'Input Splunk Query',
    'Links': 'Connect to Attributes',
    'Time': '07/28/1016/',
    'Mode': PivotTemplates.get('splunk', 'Search Splunk').name,
    'Input': 'Pivot 0'
}

const queryOptions = {
    'hosts':['staging*', 'labs*'],
    'level':['60', '50', '40'],
    'source': ["/var/log/graphistry-json/*.log"]
}

var query = `${Object.keys(queryOptions)
    .map((key) => {
        return '(' + key + '=' + queryOptions[key].join(' OR ') + ')'
    })
    .join(' ')
}`


const pivots0 = [
    createPivot(cols, {
        'Search': '',
        'Links': '*',
        'Time': '',
        'Mode': PivotTemplates.get('all', 'Search Splunk').name,
        'Input': 'none'
    }, true)
];


const pivots1 = Array.from({ length: 1 },
    function(x, index) {
        if (index == 0) {
            return createPivot(cols, {
                'Search': `${query}`,
                'Links': '*',
                'Time': '07/28/2016',
                'Mode': PivotTemplates.get('all', 'Search Splunk (dataset)').name,
                'Input': 'none'
            }, true)
        }
        else {
            return createPivot(cols, placeHolder, true)
        }
    }
);

const pivots2 = Array.from({ length: 2 },
    function(x, index) {
        if (index == 0) {
            return createPivot(cols, {
                'Search': `malware`,
                'Links': 'dest_ip, misc',
                'Time': '07/28/2016',
                'Mode': PivotTemplates.get('splunk', 'Search Splunk').name,
                'Input': 'none'
            }, true)
        }
        else {
            return createPivot(cols, placeHolder)
        }
    }
);


const pivots3 = [
    createPivot(cols, {
        'Search': 'BRO8ZA4A',
        'Links': '*',
        'Time': '',
        'Mode': PivotTemplates.get('alert_demo', 'Search FireEye').name,
        'Input': 'none'
    }, true),
    createPivot(cols, {
        'Search': '',
        'Links': '*',
        'Time': '',
        'Mode': PivotTemplates.get('alert_demo', 'Expand with Fire Eye').name,
        'Input': 'Pivot 0'
    }, true),
    createPivot(cols, {
        'Search': '',
        'Links': '*',
        'Time': '',
        'Mode': PivotTemplates.get('alert_demo', 'Expand with Blue Coat').name,
        'Input': 'Pivot 1'
    }, true),
    createPivot(cols, {
        'Search': '',
        'Links': '*',
        'Time': '',
        'Mode': PivotTemplates.get('alert_demo', 'Expand with Firewall').name,
        'Input': 'Pivot 2'
    }, false)
];

const pivots4 = [
    createPivot(cols, {
        'Search': '',
        'Links': '*',
        'Time': '',
        'Mode': PivotTemplates.get('alert_demo', 'Search Splunk (alerts)').name,
        'Input': 'none'
    }, true)
];


const pivots5 = [
    createPivot(cols, {
        'Search': '',
        'Links': '*',
        'Time': '',
        'Mode': PivotTemplates.get('health_demo', 'Search Splunk (health)').name,
        'Input': 'none'
    }, true)
];

const investigation1 = {
    name: 'Dataset Errors',
    pivots: pivots1
}

const investigation2 = {
    name: 'Very Mal Ware',
    pivots: pivots2
}

const investigation3 = {
    name: 'Botnet',
    pivots: pivots3
}

const investigation4 = {
    name: 'Empty alerts',
    pivots: pivots4
}

const investigation5 = {
    name: 'Empty health',
    pivots: pivots5
}
const app = createApp([investigation1, investigation2, investigation3,
                       investigation4, investigation5]);

pivots0.name = 'Empty (splunk)';
pivots0.templates = 'all';
pivots1.name = 'Dataset Errors';
pivots1.templates = 'alert_demo';
pivots2.name = 'Malware';
pivots1.templates = 'alert_demo';
pivots3.name = 'Botnet BRO8ZA4A';
pivots1.templates = 'alert_demo';
pivots4.name = 'Empty (alerts)';
pivots4.templates = 'alert_demo';
pivots5.name = 'Empty (health)';
pivots5.templates = 'health_demo';

const routeServices = {
    loadApp: loadApp(app),
    loadInvestigationsById: loadInvestigations(loadApp(app)),
    insertPivot, splicePivot, calcTotals, searchPivot, uploadGraph,
    loadRowsById: loadRows(loadApp(app)),
    loadPivotsById: loadPivots(loadApp(app)),
};

const modules = reloadHot(module);
const getDataSource = getDataSourceFactory(routeServices);

expressApp.use('/index.html', renderMiddleware(getDataSource, modules));
expressApp.use('/graph.html', function(req, res) {
    const { query: options = {} } = req;
    res.type('html').send(`
        <!DOCTYPE html>
        <html lang='en-us'>
            <body>
                <h1>total: ${options.total}</h1>
            </body>
        </html>
    `);
});

expressApp.use(bodyParser.urlencoded({ extended: false }));
expressApp.use('/model.json', falcorMiddleware(getDataSource));

expressApp.use('/', renderMiddleware(getDataSource, modules));
