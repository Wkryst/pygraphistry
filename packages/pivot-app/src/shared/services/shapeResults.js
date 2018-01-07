import { simpleflake } from 'simpleflakes';
import _ from 'underscore';
import { dedupeHyperedges, inference } from './shape/inference.js';
import { normalizeGraph } from './shape/normalizeGraph.js';
import { pointIconEncoding, pointColorEncoding } from './layouts';
import logger from 'pivot-shared/logger';
const log = logger.createLogger(__filename);

function summarizeOutput({ labels }) {
    //{ typeName -> int }
    const entityTypes = {};
    for (let i = 0; i < labels.length; i++) {
        entityTypes[labels[i].canonicalType] = i;
    }

    //{ typeName -> {count, example, name, color} }
    const entitySummaries = _.mapObject(entityTypes, (example, entityType) => {
        return {
            count: 0,
            example: example,
            name: entityType,
            icon:
                pointIconEncoding.mapping.categorical.fixed[labels[example].canonicalType] ||
                pointIconEncoding.mapping.categorical.other,
            color:
                pointColorEncoding.mapping.categorical.fixed[labels[example].canonicalType] ||
                pointColorEncoding.mapping.categorical.other
        };
    });

    //{ typeName -> {?valName} }
    const valLookups = _.mapObject(entityTypes, () => {
        return {};
    });

    for (let i = 0; i < labels.length; i++) {
        const summary = entitySummaries[labels[i].canonicalType];
        const lookup = valLookups[labels[i].canonicalType];
        const key = labels[i].node;
        if (!_.has(lookup, key)) {
            lookup[key] = 1;
            summary.count++;
        }
    }

    const entitySummary = { entities: _.values(entitySummaries), resultCount: labels.length };
    return entitySummary;
}

function encodeGraph({ app, pivot }) {
    const { encodings } = pivot.template;
    const { nodes, edges } = pivot.results;

    if (encodings && encodings.point) {
        nodes.forEach(node =>
            Object.keys(encodings.point).forEach(key => {
                encodings.point[key](node);
            })
        );
    }

    if (encodings && encodings.edge) {
        edges.forEach(edge =>
            Object.keys(encodings.edge).forEach(key => {
                encodings.edge[key](edge);
            })
        );
    }

    return {
        app,
        pivot: {
            ...pivot,
            results: { nodes, edges }
        }
    };
}

function extractAllNodes(connections) {
    return connections === undefined || connections.length === 0 || connections.indexOf('*') !== -1;
}

// Convert each event into a hypergraph
//   -- hypernodes: generate EventID if none available
//   -- if generic nodes/edges, merge in
//   -- track which columns, search links, indices are used
function shapeHyperGraph({ app, pivot }) {
    const {
        events = [],
        graph: { nodes: pivotNodes = [], edges: pivotEdges = [] } = {},
        attributes = [],
        attributesBlacklist = [],
        connections = [],
        connectionsBlacklist = []
    } = pivot;
    const isStar = extractAllNodes(connections);

    const edges = [];
    const nodeLabels = [];

    const generatedEntities = {};

    const labelsToPropagate = ['index', 'product', 'vendor', 'searchLink'];

    for (let i = 0; i < events.length; i++) {
        const row = events[i];
        const eventID = row.EventID || simpleflake().toJSON();

        const provenance = labelsToPropagate.reduce((acc, field) => {
            if (row[field] !== undefined) {
                acc[field] = [row[field]];
            }
            return acc;
        }, {});

        //TODO partially evaluate outside of loop
        const entityTypes = Object.keys(row)
            .filter(field => field !== 'EventID')
            .filter(field => isStar || connections.indexOf(field) > -1)
            .filter(field => row[field] !== undefined)
            .filter(field => connectionsBlacklist.indexOf(field) === -1);

        const attribs = Object.keys(row)
            .filter(field => row[field] !== undefined)
            .filter(
                field => field === 'EventID' || !attributes.length || attributes.indexOf(field) > -1
            )
            .filter(field => attributesBlacklist.indexOf(field) === -1);

        nodeLabels.push(
            Object.assign({}, _.pick(row, attribs), {
                node: eventID,
                type: 'EventID',
                ...provenance
            })
        );

        for (let j = 0; j < entityTypes.length; j++) {
            const field = entityTypes[j];

            const stringified = String(row[field]).trim();
            if (
                field in row &&
                row[field] !== undefined &&
                row[field] !== null &&
                (stringified !== '' && stringified !== '""' && stringified !== "''")
            ) {
                let entity = generatedEntities[row[field]];
                if (!entity) {
                    entity = {
                        node: row[field],
                        type: field,
                        cols: [field],
                        ...provenance
                    };

                    nodeLabels.push(entity);
                    generatedEntities[row[field]] = entity;
                } else {
                    if (!entity.cols) {
                        entity.cols = [];
                    }
                    if (entity.cols.indexOf(field) === -1) {
                        entity.cols.push(field);
                    }
                    labelsToPropagate.forEach(fld => {
                        const val = row[fld];
                        if (val !== undefined) {
                            if (entity[fld] === undefined) {
                                entity[fld] = [val];
                            } else if (entity[fld].indexOf(val) === -1) {
                                entity[fld].push(val);
                            }
                        }
                    });
                }
                edges.push(
                    Object.assign({}, _.pick(row, attribs), {
                        destination: row[field],
                        source: eventID,
                        col: field,
                        ...provenance,
                        edge: `${eventID}:${field}`,
                        edgeType: 'EventID->' + field,
                        edgeTitle: `${eventID}->${row[field]}`
                    })
                );
            }
        }
    }

    const combinedNodes = nodeLabels
        .concat(pivotNodes)
        .filter(({ type }) => isStar || type === 'EventID' || connections.indexOf(type) > -1);

    //TODO filter by global lookup of nodes
    //  (for case where just edges here, and enriched nodes from earlier)
    const combinedEdges = edges.concat(
        pivotEdges.map(
            (edge, i) => ('edge' in edge ? edge : { ...edge, edge: `edge_${pivot.id}_${i}` })
        )
    );

    return {
        app,
        pivot: {
            ...pivot,
            results: {
                edges: combinedEdges,
                nodes: combinedNodes
            }
        }
    };
}

//dedupe hyperedges w/ same src->reftype->dst and addd inference edges
function globalInference({ app, pivot }) {
    const { nodes = [], edges = [] } = pivot.results;

    //Does not dedupe so relies on downstream graph merge
    normalizeGraph({ data: { labels: nodes, graph: edges } });

    const dedupedHyperedges = dedupeHyperedges(edges);

    const newEdges = inference({
        nodes,
        edges: dedupedHyperedges,
        encodings: pivot.template.encodings
    });

    return {
        app,
        pivot: {
            ...pivot,
            results: {
                graph: dedupedHyperedges.concat(newEdges),
                labels: nodes
            },
            resultSummary: summarizeOutput({ labels: nodes })
        }
    };
}

export function shapeResults({ app, pivot }) {
    return globalInference(encodeGraph(shapeHyperGraph({ app, pivot })));
}
