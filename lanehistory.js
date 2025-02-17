/**
* @NApiVersion 2.1
* @NScriptType UserEventScript
* @NModuleScope Public
*/

/* 

------------------------------------------------------------------------------------------
Script Information
------------------------------------------------------------------------------------------

Name:
SuiteQL Tab

ID:
_suiteql_tab

Description
Adds a tab w/ query results to a transaction form.

Applies To
• Sales Order (_suiteql_tab_so)


------------------------------------------------------------------------------------------
MIT License
------------------------------------------------------------------------------------------

Copyright (c) 2022 Timothy Dietrich.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


------------------------------------------------------------------------------------------
Developer
------------------------------------------------------------------------------------------

Tim Dietrich
• timdietrich@me.com
• https://timdietrich.me


------------------------------------------------------------------------------------------
History
------------------------------------------------------------------------------------------

20220511 - Tim Dietrich
• Initial version.


*/

var log, query, serverWidget;

define([ 'N/log', 'N/query', 'N/ui/serverWidget' ], main);

function main(logModule, queryModule, serverWidgetModule) {
    log = logModule;
    query = queryModule;
    serverWidget = serverWidgetModule;

    return {
        beforeLoad: beforeLoad
    }
}

function beforeLoad(context) {

    if (context.type !== context.UserEventType.VIEW) { return; }

    var suiteqlTab = context.form.addTab({
        id: 'custpage_lane_history',
        label: 'Lane History'
    });

    context.form.insertTab({
        tab: suiteqlTab,
        nexttab: 'billingtab'
    });

    var suiteqlField = context.form.addField({
        id: 'custpage_lane_history_field',
        type: serverWidget.FieldType.TEXT,
        label: 'Lane History',
        container: 'custpage_lane_history'
    });

    var records = sqlQueryRun(context);

    context.newRecord.setValue({
        fieldId: 'custpage_lane_history_field',
        value: sqlResultsTableGenerate(records)
    });

}

function sqlQueryRun(context) {
    var newRecord = context.newRecord;

    // Get the current record's field values
    var location = newRecord.getValue({ fieldId: 'location' });
    var destinationCity = newRecord.getValue({ fieldId: 'custbody_mhi_destination_city' }); //custom field, replace when using in your Netsuite environment
    var destinationState = newRecord.getValue({ fieldId: 'custbody_mhi_destination_state' }); //custom field, replace when using in your Netsuite environment

    // SQL query with placeholders for parameterized values
    var sql = `
    SELECT
        vb.id,
        tl.location,
        vb.tranid,
        v.companyName,
        vb.trandate,
        l.fullName,
        vb.custbody_destcity_vb, --custom field, replace when using in your Netsuite environment
        vb.custbody_deststate_vb, --custom field, replace when using in your Netsuite environment
        c.name,
        tl.foreignamount
    FROM
        transaction vb
    JOIN
        transactionline tl ON vb.id = tl.transaction -- joins individual transaction lines as table tl
    JOIN
        vendor v ON vb.entity = v.id -- joins vendor record as table v
    JOIN
        location l ON tl.location = l.id -- joins location record as table l
    JOIN
        classification c ON tl.class = c.id -- joins class record as table c
    WHERE
        vb.type = 'VendBill'
        AND tl.location = ?
        AND vb.custbody_destcity_vb = ?
        AND vb.custbody_deststate_vb = ?
        AND ( vb.trandate >= TO_DATE( BUILTIN.RELATIVE_RANGES( 'OY', 'START' ), 'mm/dd/yyyy' ) )
        AND ( vb.trandate <= TO_DATE( BUILTIN.RELATIVE_RANGES( 'OY', 'END' ), 'mm/dd/yyyy' ) )
    ORDER BY
        vb.trandate DESC;
    `;

    // Execute the query with the parameters passed as an array
    var results = query.runSuiteQL({
        query: sql,
        params: [location, destinationCity, destinationState] // Parameters in array form
    }).asMappedResults();

    return results;
}

function sqlResultsTableGenerate(records) {

    if (records.length === 0) {    
        return '<div><p>No records were found.</p></div>';    
    }

    let thead = `
        <thead>
            <tr>
                <th>Bill Number</th>            
                <th>Date</th>
				<th>Vendor</th>
                <th>Location</th>
                <th>Ship City</th>
                <th>Ship State</th>
                <th>Amount</th>
            </tr>
        </thead>`;    
    
    var tbody = '<tbody>';
    
    // Log to check the structure of the first record
    //log.debug('Record Structure:', JSON.stringify(records[0]));

    // Loop through records and populate the table rows
    for (var r = 0; r < records.length; r++) {
    
        var record = records[r];

        // Log each record to see the structure
        //log.debug('Processing Record:', JSON.stringify(record));

        // Construct the Netsuite URL for the Bill's transaction
        var netsuiteUrl = `https://NETSUITEID.app.netsuite.com/app/accounting/transactions/vendbill.nl?id=${record.id}&whence=`; //if you are using default Netsuite URL schema, replace the "NETSUITEID" text with your Netsuite account ID

        // Use the properties from the record to populate the <td> elements
        tbody += `
            <tr>            
                <td><a href="${netsuiteUrl}" target="_blank">${record.tranid}</a></td>
                <td>${record.trandate}</td>
				<td>${record.companyname}</td>
                <td>${record.fullname}</td>
                <td>${record.custbody_destcity_vb}</td>
                <td>${record.custbody_deststate_vb}</td>
                <td>$${record.foreignamount.toFixed(2)}</td>
            </tr>`;    

    }    
    
    tbody += '</tbody>';

    let stylesheet = `
    <style type="text/css">
        /* Ensure the body and html elements stretch to 100% width */
        html, body {
            width: 100%;
            margin: 0;
            padding: 0;
        }

        /* Styled Table */
        .styled-table {
            border-collapse: collapse;
            margin: 0;
            font-size: 0.9em;
            font-family: sans-serif;
            width: 100%; /* Ensure the table takes up the full available width */
            box-sizing: border-box; /* Include padding and borders in the width */
            table-layout: fixed; /* This ensures that columns are evenly spaced */
        }

        .styled-table th, .styled-table td {
            padding: 6px;
            text-align: left;  /* Ensure text aligns left for consistency */
            word-wrap: break-word; /* Prevent text overflow */
        }

        .styled-table thead tr {
            background-color: #E5E5E5;
        }

        .styled-table tbody tr {
            border-bottom: thin solid #dddddd;
        }

        .styled-table tbody tr:nth-of-type(even) {
            background-color: #f3f3f3;
        }

        .styled-table tbody tr.active-row {
            font-weight: bold;
            color: #009879;
        }

        .styled-table tbody tr:hover {
            background-color: #ffff99;
        }

        /* Ensure the container spans the full width of the screen */
        .table-container {
            width: 100%;
            overflow-x: auto;  /* This will allow horizontal scrolling if necessary */
            margin: 0;          /* Remove any margins around the container */
            padding: 0;         /* Remove padding to prevent any space around the table */
        }
    </style>
`;


  return `
    ${stylesheet}

    <link rel="stylesheet" type="text/css" href="https://cdn.datatables.net/1.10.25/css/jquery.dataTables.css">
    <script type="text/javascript" charset="utf8" src="https://cdn.datatables.net/1.10.25/js/jquery.dataTables.js"></script>

    <div class="table-container">

        <table id="sqlResultsTable" class="styled-table">
            ${thead}
            ${tbody}
        </table>

    </div>

    <script>

        window.jQuery = window.$ = jQuery;

        $('#sqlResultsTable').DataTable({ "pageLength": 10, "lengthMenu": [10, 25, 50, 75, 100], "order": [1, 'desc'] });

    </script>
`;
}