 // Tool Tips
 $(function () {
    $('[data-toggle="tooltip"]').tooltip()
})

// Datatables.net table
$(document).ready(function() {

    $('#cckit_table').DataTable( {
        "order": [[ 0, "desc" ]],
        "pageLength": 50,
    scrollX: true,
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
        { data: 'html_url'}
    ],
    columnDefs: [
        {   // Left justify headers
            targets: [ 0, 1, 2, 3, 4, 5, 6, 7],
            className: 'dt-body-left breakwords'
        },
        {   // Center justify headers
            targets: [ 8, 9, 10, 11 ],
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
        {
            targets: [8, 9],
            width: "4rem",
        },
        {   // GitHub Link
            targets: 10,
            width: "2rem",
            render: $.fn.dataTable.render.hyperLink( '<i class="fab fa-github fa-lg"></i>')
        },
        {
            targets: 11,
            width: "1rem",
            render: function (data, type, row) {
                let onClickFunc = `render_graphs("${row.url}")`;
                return `<i id=row.id class="fas fa-chart-line" onClick=${onClickFunc} style="cursor: pointer; color: green"></i>`;
            }
        },
    ]

    } );

    
} );
 let clonePlot = null;
 let trafficPlot = null;

 let span = document.getElementsByClassName("close")[0];
 let modal = document.getElementById("myModal");
 span.onclick = function() {
     modal.style.display = "none";
 }
 window.onclick = function(event) {
     if (event.target === modal) {
         modal.style.display = "none";
     }
 };
 function render_graphs(url){
     fetch('./stats.json')
         .then((response) => response.json())
         .then((json) => {
             // now display the modal
             let modal = document.getElementById("myModal");
             modal.style.display = "block";
             let modalHeader = document.getElementById("modal_header");
             let urlPieces = url.split("/");
             modalHeader.innerText = "Stats for " + urlPieces[urlPieces.length -1];
             let clone_data = [];
             let traffic_data = [];
             let x_axis = [];
             let clone_count = [];
             let clone_unique = [];
             let traffic_count = [];
             let traffic_unique = [];
             let keys = [];
             try{
                 keys = Object.keys(json[url]);
             }catch(error){
                 if (clonePlot !== null){
                     clonePlot.destroy();
                 }
                 if (trafficPlot !== null){
                     trafficPlot.destroy();
                 }
                 return;
             }

             keys = keys.sort();
             for (let i = 0; i < keys.length; i++) {
                 let d = keys[i];
                 x_axis.push( Math.floor(new Date(d).getTime() / 1000) );
                 clone_count.push(json[url][d]["clones"]["count"]);
                 clone_unique.push(json[url][d]["clones"]["unique"]);
                 traffic_count.push(json[url][d]["traffic"]["count"]);
                 traffic_unique.push(json[url][d]["traffic"]["unique"]);
             }
             clone_data = [
                 x_axis, clone_count, clone_unique
             ];
             traffic_data = [
                 x_axis, traffic_count, traffic_unique
             ]

             const clone_opts = {
                 width: document.getElementById("mygraph_clones").offsetWidth,
                 height: 600,
                 id: "mygraph_clones",
                 title: "Clone Stats",
                 scales: {
                     x: {
                         time: true,
                         // snap x-zoom to exact data values
                         range: (u, min, max) => [
                             clone_data[0][u.valToIdx(min)],
                             clone_data[0][u.valToIdx(max)],
                         ],
                     },
                 },
                 hooks: {
                     drawSeries: [
                         (u, si) => {
                             let ctx = u.ctx;

                             ctx.save();

                             let s  = u.series[si];
                             let xd = u.data[0];
                             let yd = u.data[si];

                             let [i0, i1] = s.idxs;

                             let x0 = u.valToPos(xd[i0], 'x', true);
                             let y0 = u.valToPos(yd[i0], 'y', true);
                             let x1 = u.valToPos(xd[i1], 'x', true);
                             let y1 = u.valToPos(yd[i1], 'y', true);

                             const offset = (s.width % 2) / 2;

                             ctx.translate(offset, offset);

                             ctx.beginPath();
                             ctx.strokeStyle = s._stroke;
                             ctx.setLineDash([5, 5]);
                             ctx.moveTo(x0, y0);
                             ctx.lineTo(x1, y1);
                             ctx.stroke();

                             ctx.translate(-offset, -offset);

                             ctx.restore();
                         }
                     ]
                 },
                 series: [
                     {},
                     {
                         label: "Total Count",
                         stroke: "red",
                         fill: "rgba(255,0,0,0.1)",
                     },
                     {
                         label: "Unique Count",
                         stroke: "blue",
                         fill: "rgba(0,0,255,0.1)",
                     },
                 ],
             };
             if (clonePlot === null){
                 clonePlot = new uPlot(clone_opts, clone_data, document.getElementById("mygraph_clones"));
             } else {
                 clonePlot.destroy()
                 clonePlot = new uPlot(clone_opts, clone_data, document.getElementById("mygraph_clones"));
             }
             const traffic_opts = {
                 width: document.getElementById("mygraph_views").offsetWidth,
                 height: 600,
                 id: "mygraph_views",
                 title: "View Stats",
                 scales: {
                     x: {
                         time: true,
                         // snap x-zoom to exact data values
                         range: (u, min, max) => [
                             traffic_data[0][u.valToIdx(min)],
                             traffic_data[0][u.valToIdx(max)],
                         ],
                     },
                 },
                 hooks: {
                     drawSeries: [
                         (u, si) => {
                             let ctx = u.ctx;

                             ctx.save();

                             let s  = u.series[si];
                             let xd = u.data[0];
                             let yd = u.data[si];

                             let [i0, i1] = s.idxs;

                             let x0 = u.valToPos(xd[i0], 'x', true);
                             let y0 = u.valToPos(yd[i0], 'y', true);
                             let x1 = u.valToPos(xd[i1], 'x', true);
                             let y1 = u.valToPos(yd[i1], 'y', true);

                             const offset = (s.width % 2) / 2;

                             ctx.translate(offset, offset);

                             ctx.beginPath();
                             ctx.strokeStyle = s._stroke;
                             ctx.setLineDash([5, 5]);
                             ctx.moveTo(x0, y0);
                             ctx.lineTo(x1, y1);
                             ctx.stroke();

                             ctx.translate(-offset, -offset);

                             ctx.restore();
                         }
                     ]
                 },
                 series: [
                     {},
                     {
                         label: "Total Count",
                         stroke: "red",
                         fill: "rgba(255,0,0,0.1)",
                     },
                     {
                         label: "Unique Count",
                         stroke: "blue",
                         fill: "rgba(0,0,255,0.1)",
                     },
                 ],
             };
             if (trafficPlot === null){
                 trafficPlot = new uPlot(traffic_opts, traffic_data, document.getElementById("mygraph_views"));
             } else {
                 trafficPlot.destroy();
                 trafficPlot = new uPlot(traffic_opts, traffic_data, document.getElementById("mygraph_views"));
             }
         });
 }