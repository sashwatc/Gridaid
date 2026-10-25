import React from 'react';
import {createRoot} from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './style.css';
import './planner.css';
import './theme.css';
import './workspace.css';
import {DetailedWorkspace} from './DetailedWorkspace';
import {CitizenPlanner} from './components/CitizenPlanner';
import {ThemeProvider} from './theme';

const detailed=new URLSearchParams(window.location.search).get('view')==='advanced';
createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeProvider>{detailed?<DetailedWorkspace/>:<CitizenPlanner/>}</ThemeProvider></React.StrictMode>);
