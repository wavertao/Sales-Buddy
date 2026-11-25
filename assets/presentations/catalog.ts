export const presentationCategories=[
 ['PRE-01','售前','客户首次交流介绍'],['PRE-02','售前','高层战略会晤'],['PRE-03','售前','需求发现工作坊'],['PRE-04','售前','大型储能解决方案'],['PRE-05','售前','工商业储能价值交流'],['PRE-06','售前','渠道合作与激活'],
 ['PRD-01','产品','产品组合与选型'],['PRD-02','产品','系统架构与接口'],['PRD-03','产品','性能与技术参数'],['PRD-04','产品','安全设计与验证'],['PRD-05','产品','EMS与运行管理'],
 ['MID-01','售中','技术澄清与方案评审'],['MID-02','售中','投标技术响应'],['MID-03','售中','商务条件交流'],['MID-04','售中','合同交接与交付启动'],
 ['POST-01','售后','调试与验收交流'],['POST-02','售后','运维培训与服务支持'],['POST-03','售后','问题分析与整改复盘'],['POST-04','售后','生命周期服务与扩容'],
 ['GEN-01','通用','授权客户案例'],['GEN-02','通用','区域交流资料'],['GEN-03','通用','面客FAQ与异议解释'],['GEN-04','通用','收益测算解释'],['GEN-05','通用','品牌与演示模板']
].map(([id,category,title])=>({id,category,title}));
export const researchSources=[
 {id:'IEA-BAT',title:'IEA · Batteries and Secure Energy Transitions',url:'https://www.iea.org/reports/batteries-and-secure-energy-transitions/executive-summary',date:'2024-04-25',use:'储能应用与电力系统灵活性的背景，不引用预测为公司承诺'},
 {id:'EPRI-BESS',title:'EPRI · Utility BESS Handbook',url:'https://storagewiki.epri.com/index.php/Utility_BESS_Handbook',date:'2026-10-26',use:'项目全生命周期、职责与交接主题；检索摘要可用，正文访问不稳定'},
 {id:'UK-SAFE',title:'DESNZ · Grid scale electrical energy storage systems: health and safety',url:'https://www.gov.uk/government/publications/grid-scale-electrical-energy-storage-systems-health-and-safety',date:'2024-04-18',use:'安全关注贯穿项目阶段；不声称企业已获得任何认证'},
 {id:'PNNL-BTM',title:'PNNL · Analytical Sizing Methods for behind-the-meter Battery Storage',url:'https://www.pnnl.gov/publications/analytical-sizing-methods-behind-meter-battery-storage',date:'2017-08-01',use:'负荷、电价与电池约束影响测算；不承诺回收期'},
 {id:'ARENA-BAT',title:'ARENA · What is battery storage?',url:'https://arena.gov.au/renewable-energy/battery-storage/',date:'2026-09-22',use:'电网侧、表后及微网场景和知识共享背景'},
 {id:'IEA-MENA',title:'IEA · The Future of Electricity in the Middle East and North Africa',url:'https://www.iea.org/reports/the-future-of-electricity-in-the-middle-east-and-north-africa/executive-summary',date:'2025',use:'区域能源与灵活性背景；不把区域概况当作客户需求事实'}
].map(s=>({...s,retrievedAt:'2026-10-26',kind:'public_primary_source'}));
type Topic={id:string;title:string;english:string;mode:string;keywords:string;sourceIds:string[];pages:[string,string[]][]};
export const mockTopics:Topic[]=[
 {id:'PRE-01',title:'客户首次交流介绍',english:'Energy storage customer introduction',mode:'all',keywords:'首次拜访 初访 公司介绍 业务目标 客户需求',sourceIds:['IEA-BAT','ARENA-BAT'],pages:[
 ['Customer priorities',['Renewable integration and operating flexibility','Customer requirements define the project scope','The next step is a joint needs discussion']],
 ['Application scenarios',['Grid connected projects','Behind the meter facilities','Microgrids and resilience requirements']],
 ['Project stakeholders',['Identify the asset owner and contract customer','Understand technical and purchasing roles','Confirm who owns the next decision']],
 ['Scope of the discussion',['System boundaries and site interfaces','Responsibilities during project delivery','Service needs over the operating life']],
 ['Information for the next meeting',['Application objective and operating constraints','Site and electrical connection information','Target milestones and decision process']],
 ['Open questions',['Which operating problem matters most?','What information has the customer confirmed?','Who should join the technical discussion?']]
 ]},
 {id:'PRE-02',title:'高层战略会晤',english:'Executive energy storage discussion',mode:'all',keywords:'高层 战略 合作 价值 投资 决策 资源',sourceIds:['IEA-BAT','IEA-MENA'],pages:[
 ['Business objectives',['Clarify the customer investment objective','Separate project priorities from market assumptions','Agree which decisions the meeting should support']],
 ['Portfolio priorities',['Compare projects by readiness and customer commitment','Identify decisions that require management support','Keep each opportunity scope separate']],
 ['Investment discussion',['Inputs include operating objectives and constraints','Scenario analysis does not guarantee returns','Confirm the customer evaluation criteria']],
 ['Delivery confidence',['Discuss interfaces and organisational responsibilities','Identify project dependencies early','Use evidence rather than generic promises']],
 ['Cooperation framework',['Define joint working roles','Agree an initial technical workstream','Specify the next review milestone']],
 ['Decision agenda',['Which project deserves first attention?','Who can sponsor the next review?','What evidence is needed before committing resources?']]
 ]},
 {id:'PRE-04',title:'大型储能解决方案',english:'Utility scale storage solution',mode:'utility_scale',keywords:'大储 系统架构 技术方案 电池 PCS BMS EMS 接口 供货边界',sourceIds:['ARENA-BAT','EPRI-BESS','UK-SAFE'],pages:[
 ['Application and operating objectives',['Define the intended operating services','Confirm connection and dispatch requirements','Record assumptions that need customer validation']],
 ['System architecture',['Battery system and battery management','Power conversion and site electrical interfaces','Energy management and supervisory control']],
 ['Scope and interfaces',['Define supplier and site responsibilities','Document electrical and communication interfaces','Keep unresolved interfaces visible']],
 ['Site readiness',['Review site access and environmental conditions','Confirm civil and connection dependencies','Coordinate local project specialists']],
 ['Performance discussion',['Agree units, test conditions and measurement points','Use the applicable product specification','Do not infer guaranteed values from examples']],
 ['Technical review agenda',['Review the customer requirements baseline','Resolve critical interface ownership','Agree the next technical submission']]
 ]},
 {id:'PRE-05',title:'工商业储能价值交流',english:'Commercial and industrial storage',mode:'commercial_industrial',keywords:'工商业 负荷 电价 收益 测算 回收期 投资 需量',sourceIds:['PNNL-BTM','ARENA-BAT'],pages:[
 ['Facility objectives',['Discuss energy cost and operational needs','Identify resilience requirements','Confirm the customer investment model']],
 ['Load and tariff inputs',['Collect interval load information','Check energy and demand charge structures','Assess data completeness before modelling']],
 ['Operating constraints',['Discuss available connection capacity','Understand facility schedules and dispatch limits','Confirm site and safety requirements']],
 ['Value assessment',['Separate verified inputs from assumptions','Compare scenarios with explicit limitations','Avoid a generic guaranteed payback claim']],
 ['Customer review',['Invite energy, finance and technical roles','Agree the evaluation criteria','List the information still needed']],
 ['Data collection plan',['Assign an owner for load and billing data','Agree a review date','Confirm the next modelling discussion']]
 ]},
 {id:'PRE-06',title:'渠道合作与激活',english:'Partner cooperation and activation',mode:'channel_project',keywords:'伙伴 渠道 分销 评估 激活 合作 联合 项目 服务',sourceIds:['EPRI-BESS'],pages:[
 ['Partner objectives',['Understand the intended customer segments','Confirm the partner role in local projects','Identify the first opportunities to validate']],
 ['Capability discussion',['Assess technical and commercial coverage','Clarify installation and service arrangements','Separate stated capability from confirmed evidence']],
 ['First opportunity review',['Confirm the customer contact and project context','Discuss the real requirement and timeline','Record qualification gaps']],
 ['Joint delivery boundaries',['Assign customer and technical communication roles','Define escalation responsibilities','Confirm service interfaces before commitments']],
 ['Activation milestones',['Start with a joint opportunity review','Agree required training and support','Tie further resources to verified progress']],
 ['Cooperation questions',['Who has access to the customer decision process?','Which service gaps need local support?','What is the first agreed customer action?']]
 ]},
 {id:'PRD-01',title:'产品组合与系统架构',english:'Product portfolio and interfaces',mode:'all',keywords:'产品 电池 PCS EMS BMS 参数 安全 架构 接口 选型 技术',sourceIds:['ARENA-BAT','UK-SAFE'],pages:[
 ['Product discussion framework',['Match the product discussion to the use case','Confirm the applicable product documentation','Treat all example configurations as illustrative']],
 ['Battery and power conversion',['Battery subsystems store energy','Power conversion connects the battery and site','Ratings depend on the selected specification']],
 ['Control and communication',['Identify management and monitoring interfaces','Document site communication responsibilities','Check requirements with the technical team']],
 ['Safety information',['Discuss hazards and responsibilities across the lifecycle','Use applicable test and safety documents','Confirm product specific requirements with specialists']],
 ['Selection inputs',['Application and operating environment','Connection and system interface requirements','Service scope and verification conditions']],
 ['Product clarification',['Which configuration is being evaluated?','Which parameters require a confirmed specification?','What should the next technical review resolve?']]
 ]},
 {id:'MID-01',title:'技术澄清与供货边界',english:'Technical scope clarification',mode:'all',keywords:'技术 澄清 供货 边界 接口 责任 David 采购 Sarah 范围',sourceIds:['EPRI-BESS','UK-SAFE'],pages:[
 ['Requirements baseline',['Identify the customer approved requirement version','Separate confirmed items from open questions','Keep assumptions visible during review']],
 ['Scope of supply',['List included and excluded responsibilities','Identify interfaces with the customer and other suppliers','Confirm service scope separately']],
 ['Interface responsibilities',['Assign an owner for each critical interface','Review electrical and communication boundaries','Record dependencies requiring customer input']],
 ['Comparable proposal review',['Compare the same scope and operating conditions','Clarify warranty and service assumptions','Do not treat a headline price as a complete comparison']],
 ['Review evidence',['Use current specifications and meeting records','Retain unresolved items with named owners','Confirm changes before updating the baseline']],
 ['Procurement review questions',['Who participates in technical and commercial review?','What evidence is needed for the next decision?','When will the next review take place?']]
 ]},
 {id:'MID-04',title:'交付启动与项目协同',english:'Delivery readiness and coordination',mode:'all',keywords:'交付 协同 计划 责任 FAT SAT 里程碑 现场 进度 验收',sourceIds:['EPRI-BESS','UK-SAFE'],pages:[
 ['Delivery scope',['Review the agreed contract and technical scope','Identify customer supplied work','Keep unresolved commitments in the handover log']],
 ['Roles and coordination',['Name the customer and supplier project contacts','Assign responsibility for each interface','Agree an escalation route']],
 ['Milestones and dependencies',['Map design, site readiness and delivery milestones','Identify approvals and information dependencies','Use confirmed plans rather than assumed dates']],
 ['Testing and acceptance',['Agree applicable factory and site tests','Define evidence and acceptance conditions','Track exceptions and open items']],
 ['Change management',['Record requested scope changes','Assess technical and commercial impact','Confirm changes through the agreed process']],
 ['Kickoff decisions',['Which site conditions are still pending?','Who owns each dependency?','What will be reviewed at the next project meeting?']]
 ]},
 {id:'POST-02',title:'运维培训与服务支持',english:'Operations and service support',mode:'all',keywords:'售后 运维 培训 服务 故障 告警 巡检 验收 保修',sourceIds:['EPRI-BESS','UK-SAFE'],pages:[
 ['Operations handover',['Confirm manuals and training responsibilities','Identify operating limits from approved documentation','Agree how open handover items are tracked']],
 ['Monitoring and alarms',['Define monitoring and communication contacts','Classify alarms using the applicable procedures','Record observations without inventing a diagnosis']],
 ['Maintenance planning',['Use product specific maintenance instructions','Coordinate site access and isolation requirements','Retain maintenance records']],
 ['Incident communication',['Follow the site emergency and safety plan','Escalate to qualified personnel','Keep customer updates factual and time stamped']],
 ['Service boundaries',['Confirm the applicable contract and warranty terms','Document customer and supplier responsibilities','Avoid unapproved response time promises']],
 ['Service review agenda',['Review actual operating issues','Agree evidence for problem closure','Identify follow up training needs']]
 ]},
 {id:'GEN-01',title:'储能应用案例与讨论模板',english:'Illustrative storage case discussions',mode:'all',keywords:'案例 经验 欧洲 北美 中东 亚太 应用 参考 场景',sourceIds:['ARENA-BAT','PNNL-BTM','IEA-MENA'],pages:[
 ['Utility project discussion',['Illustrative scenario, not a completed company project','Discuss connection and dispatch objectives','Compare interface and delivery lessons']],
 ['Industrial facility discussion',['Illustrative scenario, not measured financial performance','Consider facility load and tariff inputs','Confirm operating constraints before sizing']],
 ['European customer discussion',['Confirm the specific country and customer requirements','Use project specific safety and site documentation','Do not generalise one market rule to all Europe']],
 ['North American customer discussion',['Identify the asset owner, EPC and utility interfaces','Confirm local project requirements with specialists','Keep procurement and technical roles distinct']],
 ['Middle East customer discussion',['Clarify operating environment and local delivery interfaces','Discuss reliability and flexibility objectives','Validate customer needs rather than assuming regional demand']],
 ['Asia Pacific customer discussion',['Distinguish grid, facility and microgrid applications','Confirm local service and site conditions','Use lessons as questions, not supplier references']]
 ]}
];

mockTopics.push({id:'GEN-05',title:'公司介绍与标准产品组合',english:'Company overview and product portfolio',mode:'all',keywords:'公司介绍 企业概况 公司overview 标准产品 产品组合 company overview company profile product portfolio',sourceIds:[],pages:[
 ['Company Overview',['Company name: [insert approved legal name]','Business scope: energy storage systems and project support','Present only approved company facts and regional presence']],
 ['Approved Product Portfolio',['Utility scale battery energy storage systems','Commercial and industrial energy storage solutions','Product ratings and models: refer to approved data sheets']],
 ['System Building Blocks',['Battery system, BMS and power conversion','Energy management, monitoring and site interfaces','Configuration depends on the approved project requirements']],
 ['Engineering and Quality',['Discuss the engineering review process','Present applicable quality and test documentation','Use approved certificates with the correct scope and validity']],
 ['Delivery and Project Support',['Agree the supply scope and interface owners','Confirm site readiness and milestone dependencies','Use project specific delivery commitments']],
 ['Service and Cooperation',['Introduce approved service scope and support channels','Confirm warranty terms from the applicable contract','Agree the next technical or commercial review']]
 ]});
mockTopics.push({id:'PRE-03',title:'会晤开场、目标与议程标准材料',english:'Meeting welcome and objectives',mode:'all',keywords:'欢迎 开场 议程 会晤目标 交流目标 welcome objectives priorities agenda',sourceIds:[],pages:[
 ['Welcome and Meeting Objectives',['Welcome the customer team and introduce the meeting participants','Confirm what both teams want to achieve today','Agree the decisions or clarifications expected from this meeting']],
 ['Discussion Agenda',['Customer priorities and the intended application','Solution scope, interfaces and delivery considerations','Open questions, owners and the next discussion']],
 ['Customer Priorities',['Confirm the customer priorities in their own words','Distinguish confirmed needs from topics still to be explored','Agree which priorities should guide the discussion']],
 ['Expected Meeting Outcomes',['A shared understanding of the current requirements','A clear list of open questions and information needs','Owners and a target date for the next review']],
 ['Discussion Boundaries',['Keep the conversation focused on the agreed objectives','Separate exploratory options from approved commitments','Record topics requiring specialist follow up']],
 ['Questions for Discussion',['Which outcome would make this meeting useful?','Which concern should we address first?','What should both teams do immediately after this meeting?']]
 ]});
