class Visual
  @width: 960
  @height: 500

  @fill = d3.scale.category10()
  @color = d3.scale.category20()

  @init: () ->

    @svg = d3.select("body")
    .append("svg")
    .attr("width", @width)
    .attr("height", @height)

class BaseCollection

  constructor: (node_class) ->
    @._items = []
    @._links = []
    @._node_class = node_class

  node_class: () ->
    @._node_class

  items: () ->
    @._items

  links: () ->
    @._links

  add_link: (link) ->
    @._links.push link

  add: (item) ->
    @._items.push item

  remove: (item_to_remove) ->
    
    links = _.filter @._links, (l) ->
      l.source == item_to_remove or l.target == item_to_remove

    _.each links, (link) =>
      link_index = @._links.indexOf link
      @._links.splice link_index, 1

    index = @._items.indexOf item_to_remove
    @._items.splice index, 1

    @clean_up()

  force_layout: (gravity, charge) ->
    d3.layout.force()
    .nodes(@._items)
    .links(@._links)
    .linkStrength(0)
    .size([Visual.width, Visual.height])
    .gravity(gravity)
    .charge(charge)

  clean_up: () ->
    Vis.svg.selectAll(".#{@._node_class}")
    .data(@._items)
    .exit().remove()

    Vis.svg.selectAll(".link")
    .data(@._links)
    .exit().remove()

class DeaCollection extends BaseCollection

  constructor: () ->
    super "dea-node"

    @force = @force_layout(.05, -150)
    .on "tick", (e) =>

      # move dea nodes to correct position
      Visual.svg.selectAll(".#{@node_class()}")
      .attr "cx", (d) -> 
        d.x
      .attr "cy", (d) ->
        d.y
      .attr "transform", (d) ->
        "translate(#{d.x},#{d.y})"

  add: (dea) ->
    super dea
    @update_visual()

  remove: (dea) ->
    super dea
    @update_visual()

  find_by_id: (id) ->
    _.find @items(), (dea) ->
      dea.dea == id

  update_visual: () ->

    # sync visual items with internal list
    @force.start()

    Visual.svg.selectAll(".#{@node_class()}")
    .data(@items())
    .enter().append("g")
    .attr("class", @_node_class)
    .attr "id", (d) ->
      d.dea
    .append("svg:circle")
    .attr("r", 20)
    .style "fill", (d) -> 
      Visual.fill(d.index)
    .style "stroke", (d) ->
      d3.rgb(Visual.fill(d.index)).darker(5)
    .style("stroke-width", 1.5)
 
class AppCollection extends BaseCollection
  
  constructor: () ->
    super "app-node"

    @force = @force_layout(.05, -150)
    .on "tick", (e) =>
      k = .1 * e.alpha

      Visual.svg.selectAll(".link")
      .attr "x1", (d) ->
        d.source.x
      .attr "y1", (d) -> 
        d.source.y
      .attr "x2", (d) ->
        d.target.x
      .attr "y2", (d) -> 
        d.target.y

      # move app nodes to their correct position
      Visual.svg.selectAll(".#{@node_class()}")
      .attr "cx", (d) -> 
        d.x
      .attr "cy", (d) ->
        d.y
      .attr "transform", (d) ->
        d.y += (d.dea_node.y - d.y) * k;
        d.x += (d.dea_node.x - d.x) * k;

        "translate(#{d.x},#{d.y})"

  add: (app) ->
    super app
    
    # add link?
    existing_apps = @find_by_app_id app.app

    if existing_apps.length > 1
      _.each existing_apps, (a) =>
        if app != a
          @add_link
            source: app
            target: a

    @update_visual()

  remove: (app) ->
    super app
    @update_visual()

  find_by_instance_id: (id) ->
    _.find @items(), (app) ->
      app.private_instance_id == id

  find_by_app_id: (id) ->
    _.filter @items(), (app) ->
      app.app == id

  update_visual: () ->

    # sync visual items with internal list
    @force.start()

    nodes = Visual.svg.selectAll(".#{@node_class()}")
    .data(@items())
    .enter().append("g")
    .attr("class", @_node_class)
    .attr "id", (d) ->
      d.private_instance_id

    nodes.append("svg:circle")
    .attr("r", 10)
    .style "fill", (d) -> 
      Visual.fill(d.app)
    .style "stroke", (d) ->
      d3.rgb(Visual.fill(d.index)).darker(5)
    .style("stroke-width", 1.5)
    
    nodes.append("text")
    .attr("dx", 12)
    .attr("dy", ".35em")
    .text (d) -> 
      "#{d.uris[0]}\n"

    Visual.svg.selectAll(".link")
      .data(@links())
      .enter().append("line")
      .attr("class", "link")

class NATSListener
  
  receive_handlers: []
  ignore : ['discover.all', 'vcap.component.discover']
  show_nats : true

  constructor: (faye_endpoint) ->
    @faye_client = new Faye.Client(faye_endpoint)
    @faye_client.disable('websocket');
    @faye_client.subscribe '/nats', (message) =>
      
      if @ignore.indexOf(message.sub) == -1
        parsed = @parse_message message

        console.log parsed if @show_nats == true
        
        _.each @receive_handlers, (handler) ->
          handler parsed

  parse_message: (msg) ->
    {
      data: JSON.parse(msg.msg) 
      subscription: msg.sub
    }

  on_receive: (handler) ->
    @receive_handlers.push handler

Visual.init()
window.Vis = Visual

window.apps = app_collection = new AppCollection
window.deas = dea_collection = new DeaCollection

window.nl = nats_listener = new NATSListener('http://faye.cloud.gopaas.eu/faye')
nats_listener.on_receive (msg) ->

  switch msg.subscription

    when "dea.heartbeat"
      dea = msg.data
      dea_collection.add dea if not dea_collection.find_by_id(dea.dea)?

    when "router.register"
      route = msg.data
      if route.app? # does the route belong to a proper app
        if dea_collection.find_by_id(route.dea)? # have we found the dea yet?
          if not app_collection.find_by_instance_id(route.private_instance_id) # have we added it already?
            route.dea_node = dea_collection.find_by_id(route.dea)
            app_collection.add route 

    when "router.unregister"
      route = msg.data
      if route.app? # does the route belong to a proper app
        if dea_collection.find_by_id(route.dea)? # have we found the dea yet?
          if app_collection.find_by_instance_id(route.private_instance_id) # have we added it already?

            app = app_collection.find_by_instance_id(route.private_instance_id)
            app_collection.remove app 


