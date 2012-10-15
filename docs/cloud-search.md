# CloudSearch

## Create domain

    var aws = require('plata').connect({'file': 'auth.json'});
    aws.onConnect(function(){
        aws.cloudSearch.createDomain('test').then(function(status){
            console.log('Created domain: ' + JSON.stringify(
                status, null, 4));
        });
    });

## Define an index field

    aws.cloudSearch.defineIndexField('test', 'username', 'text', {
        'defaultValue': '',
        'facetEnabled': true,
        'resultEnabled': true
    }).then(function(field){
        console.log('Added index field: ' + JSON.stringify(
            field, null, 4));
    });

## List index fields

    aws.cloudSearch.describeIndexFields('test')
        .then(function(fields){
            console.log('test domain has fields ' + JSON.stringify(
                fields, null, 4));
        });

## Add documents

    var docEndPoint,
        docClient;
    aws.cloudSearch.describeDomains().then(function(domains){
        domains.any(function(domain){
            if(domain.domainName === 'test'){
                docEndPoint = domain.docService.endpoint;
                return true;
            }
        });
        docClient = aws.cloudSearch.getDocumentClient(docEndPoint);
        docClient.add('1', '1', {
            'username': 'dan',
            'location': 'New York, NY'
        });
        docClient.add('2', '1', {
            'username': 'danielle',
            'location': 'Budapest, HU'
        });
        docClient.commit()
            .then(function(result){
                console.log('Doc commit result: ' + result);
            },
            function(err){
                console.error(err);
            });
    });


## Searching documents

    var searchEndPoint,
        searchClient;
    aws.cloudSearch.describeDomains().then(function(domains){
        domains.any(function(domain){
            if(domain.domainName === 'test'){
                searchEndPoint = domain.searchService.endpoint;
                return true;
            }
        });
        searchClient = aws.cloudSearch.getSearchClient(
            searchEndPoint);
        searchClient.search({
            'bq': 'field username: ' + dan,
            'returnFields': ['username']
        }).then(function(result){
            console.log('Results found: '+result.hits);
            console.log('Results: '+ JSON.stringify(result.docs,
                null, 4));
        },
        function(err){

        });
    });
