 // Tool Tips
 $(function () {
    $('[data-toggle="tooltip"]').tooltip()
})

// Datatables.net table
$(document).ready(function() {

    $('#cckit_table').DataTable( {
        "order": [[ 0, "desc" ]],
        "pageLength": 100,

    ajax: {
        url: 'data.json',
        dataSrc: 'data'
    },
    columns: [
        { data: "latest.commit_date" },
        { data: "latest.branch", },
        { data: "category", },
        { data: "owner.login" },
        { data: "latest.icon" },
        { data: 'name',render: $.fn.dataTable.render.text() },
        { data: 'description', render: $.fn.dataTable.render.text() },
        { data: 'latest.commit_message', render: $.fn.dataTable.render.text() },
        { data: 'stargazers_count'},
        { data: 'clones.count'},
        { data: 'html_url' },
    ],
    columnDefs: [
        {   // Left justify headers
            targets: [ 0, 1, 2, 3, 4, 5, 6, 7],
            className: 'dt-body-left breakwords'
        },
        {   // Center justify headers
            targets: [ 8, 9 ],
            className: 'dt-body-center breakwords'
        },
        {   // Time format
            targets: 0,
            width: "7rem",
            render:function(data){
                // return formated date
                //return moment(data).format('YYYY-MMMM-DD');

                // Has this been updated in the last 30 days?
                var c = moment.unix(data); // date is a unix epoch date
                var d = moment().diff(c, 'days');
                if (d < 30){
                    return c.format('YYYY-MM-DD') + " " + '<i class="fas fa-star fa-lg"></i>';
                } else {
                    return c.format('YYYY-MM-DD');
                }
            }
        },
        {
            targets: 1,
            width: "8rem",
        },
        {
            targets: 2,
            width: "6rem",
        },
        {
            targets: 3,
            width: "8rem",
        },
        {   // Repo owner avatar
            targets: 4,
            width: "1rem",
            render: function ( data, type, row ) {
                return '<img width=40 height=40 src="'+ data + '" />';
            }
        },
        {
            targets: [5],
            width: "10rem",
        },
        {   // Latest commit message
            targets: 7,
            render: function ( data, type, row ) {
                return data;
            }
        },
        {
            targets: [8, 9],
            width: "4rem",
        },
        {   // GitHub Link
            targets: 10,
            width: "2rem",
            render: $.fn.dataTable.render.hyperLink( '<i class="fab fa-github fa-lg"></i>')
        },
    ]

    } );

    
} );