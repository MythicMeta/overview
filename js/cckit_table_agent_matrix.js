// Datatables.net table
function bool_render (data, type, row, meta) {
    //console.log(data, type, row, meta);
    if(data === null) {
        return '<i style="color: #bebebe" class="fas fa-times"></i>'
    }else if(typeof data === "string"){
        return data
    }else{
        return '<i style="color:green" class="fas fa-check"></i>'
    }
}
$(document).ready(function() {
    fetch('./data.json')
        .then((response) => response.json())
        .then((json) => {
            let jsonData = json["data"].reduce( (prev, cur) => {
                if(cur["category"] !== "Agent" && cur["category"] !== "Wrapper"){
                    return [...prev]
                }
                if(!cur["metadata"]){
                    return [...prev]
                }
                return [...prev, cur];
            }, []);
            // columns are each agent
            let columns = [
                {
                    data: "category", title: "category", visible: false, orderable: false
                },
                {   data: "name", title: "",
                    orderable: false,
                    render: $.fn.dataTable.render.text()
                },
            ];
            // rows are the data types
            let metadata = {
                "os": [],
                "languages": [],
                "features": {
                    "mythic": [],
                    "custom": []
                },
                "payload_output": [],
                "architectures": [],
                "c2": [],
                "supported_wrappers": []
            };
            // go through all agents and get an aggregate list of all features
            for(let i = 0; i < jsonData.length; i++){
                columns.push({
                    data: `${jsonData[i]["name"]}`,
                    title: '<img height="40px" width="40px" src="' + jsonData[i]["latest"]["icon"] + '"/>',
                    render: bool_render,
                    orderable: false
                })
                if(jsonData[i]["metadata"]["os"]){
                    jsonData[i]["metadata"]["os"].forEach( (x) => {
                        if(!metadata.os.includes(x)){
                            metadata.os.push(x);
                        }
                    })
                }
                if(jsonData[i]["metadata"]["languages"]){
                    jsonData[i]["metadata"]["languages"].forEach( (x) => {
                        if(!metadata.languages.includes(x)){
                            metadata.languages.push(x);
                        }
                    })
                }
                if(jsonData[i]["metadata"]["features"]){
                    if(jsonData[i]["metadata"]["features"]["mythic"]){
                        jsonData[i]["metadata"]["features"]["mythic"].forEach( (x) => {
                            if(!metadata.features.mythic.includes(x)){
                                metadata.features.mythic.push(x);
                            }
                        })
                    }
                    if(jsonData[i]["metadata"]["features"]["custom"]){
                        jsonData[i]["metadata"]["features"]["custom"].forEach( (x) => {
                            if(!metadata.features.custom.includes(x)){
                                metadata.features.custom.push(x);
                            }
                        })
                    }
                }
                if(jsonData[i]["metadata"]["payload_output"]){
                    jsonData[i]["metadata"]["payload_output"].forEach( (x) => {
                        if(!metadata.payload_output.includes(x)){
                            metadata.payload_output.push(x);
                        }
                    })
                }
                if(jsonData[i]["metadata"]["architectures"]){
                    jsonData[i]["metadata"]["architectures"].forEach( (x) => {
                        if(!metadata.architectures.includes(x)){
                            metadata.architectures.push(x);
                        }
                    })
                }
                if(jsonData[i]["metadata"]["c2"]){
                    jsonData[i]["metadata"]["c2"].forEach( (x) => {
                        if(!metadata.c2.includes(x)){
                            metadata.c2.push(x);
                        }
                    })
                }
                if(jsonData[i]["metadata"]["supported_wrappers"]){
                    jsonData[i]["metadata"]["supported_wrappers"].forEach( (x) => {
                        if(!metadata.supported_wrappers.includes(x)){
                            metadata.supported_wrappers.push(x);
                        }
                    })
                }
            }
            let newData = [];
            metadata.os.forEach( (x) => {
                newData.push(jsonData.reduce( (prev, cur) => {
                    if(cur["metadata"]["os"]){
                        if(cur["metadata"]["os"].includes(x)){
                            return {...prev, [cur.name]: true}
                        }
                    }
                    return {...prev, [cur.name]: null}
                }, {name: x, category: "Operating System"}));
            })
            metadata.languages.forEach( (x) => {
                newData.push(jsonData.reduce( (prev, cur) => {
                    if(cur["metadata"]["languages"]){
                        if(cur["metadata"]["languages"].includes(x)){
                            return {...prev, [cur.name]: true}
                        }
                    }
                    return {...prev, [cur.name]: null}
                }, {name: x, category: "Agent Languages"}));
            })
            metadata.c2.forEach( (x) => {
                newData.push(jsonData.reduce( (prev, cur) => {
                    if(cur["metadata"]["c2"]){
                        if(cur["metadata"]["c2"].includes(x)){
                            return {...prev, [cur.name]: true}
                        }
                    }
                    return {...prev, [cur.name]: null}
                }, {name: x, category: "Supported C2"}));
            })
            metadata.payload_output.forEach( (x) => {
                newData.push(jsonData.reduce( (prev, cur) => {
                    if(cur["metadata"]["payload_output"]){
                        if(cur["metadata"]["payload_output"].includes(x)){
                            return {...prev, [cur.name]: true}
                        }
                    }
                    return {...prev, [cur.name]: null}
                }, {name: x, category: "Payload Output Types"}));
            })
            metadata.architectures.forEach( (x) => {
                newData.push(jsonData.reduce( (prev, cur) => {
                    if(cur["metadata"]["architectures"]){
                        if(cur["metadata"]["architectures"].includes(x)){
                            return {...prev, [cur.name]: true}
                        }
                    }
                    return {...prev, [cur.name]: null}
                }, {name: x, category: "Architectures Supported"}));
            })
            metadata.supported_wrappers.forEach( (x) => {
                newData.push(jsonData.reduce( (prev, cur) => {
                    if(cur["metadata"]["supported_wrappers"]){
                        if(cur["metadata"]["supported_wrappers"].includes(x)){
                            return {...prev, [cur.name]: true}
                        }
                    }
                    return {...prev, [cur.name]: null}
                }, {name: x, category: "Supported Wrappers"}));
            })
            metadata.features.mythic.forEach( (x) => {
                newData.push(jsonData.reduce( (prev, cur) => {
                    if(cur["metadata"]["features"]){
                        if(cur["metadata"]["features"]["mythic"]){
                            if(cur["metadata"]["features"]["mythic"].includes(x)){
                                return {...prev, [cur.name]: true}
                            }
                        }
                    }
                    return {...prev, [cur.name]: null}
                }, {name: x, category: "Mythic Supported Features"}));
            })
            metadata.features.custom.forEach( (x) => {
                newData.push(jsonData.reduce( (prev, cur) => {
                    if(cur["metadata"]["features"]){
                        if(cur["metadata"]["features"]["custom"]){
                            if(cur["metadata"]["features"]["custom"].includes(x)){
                                return {...prev, [cur.name]: true}
                            }
                        }
                    }
                    return {...prev, [cur.name]: null}
                }, {name: x, category: "Custom Supported Features"}));
            })
            newData.push(jsonData.reduce( (prev, cur) => {
                return {...prev, [cur.name]: cur["metadata"]?.["dynamic_loading"] || null}
            }, {name: "Dynamic Loading", category: "Misc"}));
            newData.push(jsonData.reduce( (prev, cur) => {
                return {...prev, [cur.name]: cur["metadata"]?.["mythic_version"] || null}
            }, {name: "Mythic Version", category: "Misc"}));
            newData.push(jsonData.reduce( (prev, cur) => {
                return {...prev, [cur.name]: cur["metadata"]?.["agent_version"] || null}
            }, {name: "Agent Version", category: "Misc"}));
            const table = new DataTable('#cckit_table_agent_matrix', {
                "pageLength": 100,
                rowGroup: {
                    dataSrc: "category"
                },
                fixedColumns: {
                    left: 1
                },
                fixedHeader: true,
                scrollX: true,
                scrollY: 500,
                data: newData,
                columns: columns,
                columnDefs: [
                    {   // Left justify headers
                        targets: [ "_all"],
                        className: 'border-top breakwords'
                    },
                ]

            } )
            table.on('mouseenter', 'td', function () {
                let colIdx = table.cell(this).index().column;

                table
                    .cells()
                    .nodes()
                    .each((el) => el.classList.remove('highlight'));

                table
                    .column(colIdx)
                    .nodes()
                    .each((el) => el.classList.add('highlight'));
            });
        });

} );