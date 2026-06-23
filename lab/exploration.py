import ipywidgets as widgets
import plotly.express as px
import pandas as pd
import numpy as np


import matplotlib.pyplot as plt
import seaborn as sns

def display(*args, **kwargs):
    try:
        from IPython.display import display as _display
        return _display(*args, **kwargs)
    except (ImportError, ModuleNotFoundError):
        return print(*args, **kwargs)

from typing import Any, Dict, List

def parse_results(results: List[Dict[str, Any]]) -> pd.DataFrame:
    df_results = pd.DataFrame(results)
    df_results['gen.swaps'] = df_results['gen.swaps'].astype('Int64')

    if 'gen.id' in df_results:
        df_results[['datagen_index', 'run_index', 'data_hash']] = df_results['gen.id'].str.split('_', expand=True)

    df_results['task_label'] = \
        df_results['executor'].astype(str) + ' ' + df_results['args'].str.join(" ")

    columns=[
        'datagen_index', 
        'run_index', 
        'data_hash', 
        'executor', 
        'args', 
        'task_label', 
        'gen.cardinality', 
        'gen.multiplicity', 
        'gen.swaps', 
        'gen.descending', 
        'gen.seed', 
        'metric'
    ]
    return df_results.reindex(columns=columns)

def _clean_results(df : pd.DataFrame)-> pd.DataFrame:
    if df.empty: return df

    # Filter for minimum duration per group to remove system jitter
    df_filtered = df.loc[df.groupby(['data_hash', 'task_label'])['metric'].idxmin()] #.reset_index()

    # A maximal swap (equal to the size of the input array) param is denoted by None
    # The size of the input array can be inferred as the product of its cardinality and multiplicity
    df_filtered['size'] = df_filtered['gen.cardinality'] * df_filtered['gen.multiplicity']
    df_filtered['gen.swaps'] = df_filtered['gen.swaps'].fillna(df_filtered['size']).astype('int64')
    # if 'experiment_name' in df_filtered:
    #     df_filtered['task_label'] = '[' + df_filtered['experiment_name'].astype(str) + '] ' + df_filtered['task_label'].astype(str)
    # df_filtered['task_label'] = df_filtered['task_label'].astype(str)
    return df_filtered

class Explorer:
    
    def __init__(
        self,
        clean_df: pd.DataFrame,
    ):
        self.clean_df = clean_df

        

    def get_raw_data(self) -> pd.DataFrame:
        return self.raw_df

    def get_clean_data(self) -> pd.DataFrame:
        return self.clean_df


    def plot_trends_interactive(self, varying_param_name: str, title="Median Sort Performance", normalized=False, xlog=False, ylog=False, show_table=False):
        """
        Creates a line chart showing the median duration trends.
        """
        df = self.clean_df
        try:
            import plotly.express as px
        except ImportError:
            print("Plotly not installed. Please install it to view charts.")
            return

        if df.empty:
            print("Dataframe is empty. Skipping visualization.")
            return

        print(f"--- Interactive Trend: {title} ---")
        metric_type = 'metric'
        metric_title =  'Duration'
        if normalized:
            metric_type = 'nomalized_metric'
            metric_title = 'Nomalized Duration'
            df['nomalized_metric'] = df['metric'] / df[varying_param_name]

        # Aggregate data
        df_summary = df.groupby([varying_param_name, 'task_label'])[metric_type].median().reset_index()
        
        if show_table:
            print("Median Durations (ns):")
            display(df_summary)

        fig = px.line(
            df_summary,
            x=varying_param_name,
            y=metric_type,
            color='task_label',
            markers=True,
            title=title,
            labels={
                varying_param_name: varying_param_name.title(),
                metric_type: f"{metric_title} (ns)",
                'task_label': "Algorithm"
            }
        )

        if xlog: 
            fig.update_xaxes(type="log")
        if ylog: 
            fig.update_yaxes(type="log")
        
        fig.update_layout(
            height=600, 
            hovermode="x unified",
            xaxis_title=varying_param_name.title(), 
            yaxis_title=f"{metric_title} (ns)"
        )
        fig.show()




    def plot_distributions(self, varying_param_name : str|None = None, title: str = f'Performance Distributions', normalized=False, ylog=False):

        df = self.clean_df

        if df.empty:
            print("df is empty. Skipping analysis and visualization.")
            return

        metric_type = 'metric'
        metric_title =  'Duration'
        if normalized:
            metric_type = 'nomalized_metric'
            metric_title = 'Nomalized Duration'
            df['nomalized_metric'] = df['metric'] / df[varying_param_name]

        # # 1. Overall Distribution Plot for this experiment, showing all data points
        # print(f"--- Overall Distributions (Varying {varying_param_name.title()} Experiment) ---")

        plt.figure(figsize=(12, 10)) # Increase figure size for better readability


        # Create a new column that combines cardinality and function name for the x-axis
        # df['cardinality_function'] = df['gen.cardinality'].astype(str) #+ ' - ' + df_baseline['function_name']

        # Use boxplot to show the distribution
        sns.boxplot(
            data=df,
            x=varying_param_name or df.index,
            y=metric_type,
            hue='task_label', # Color by function name (algorithm)
            fliersize=0 # Hide outliers in the boxplot as they will be in the stripplot
        )

        sns.stripplot(
            data=df,
            x=varying_param_name or df.index,
            y=metric_type,
            palette='dark:black',
            hue='task_label', # Color by function name (algorithm)
            dodge=True, # Dodge points to align with boxplots
            jitter=0.2,
            alpha=0.3,
            size=3,
            legend=False # Hide the legend for the stripplot to avoid duplicates
        )

        # plt.title(f'Performance Distributions vs. {varying_param_name.title()} {desc_fixed_params}', fontsize=16)
        plt.title(title, fontsize=16)

        # plt.xlabel(f'{varying_param_name.title()} - Sorting Function', fontsize=12)
        plt.xlabel(f'{str(varying_param_name or 'Index')}'.title(), fontsize=12)

        plt.ylabel(f'{metric_title} (ns)', fontsize=12)
        plt.xticks(rotation=45, ha='right')  # Rotate x-axis labels for better readability
        plt.grid(axis='y', linestyle='--', alpha=0.7)


        # Adjust legend to show only language
        handles, labels = plt.gca().get_legend_handles_labels()
        # Assuming 'language' is the first hue variable used in boxplot
        # Get unique function names for legend
        function_names = df['task_label'].unique()
        n_functions = len(function_names)
        plt.legend(handles[:n_functions], labels[:n_functions], title='Algorithm', fontsize=10)
        if ylog:
            plt.yscale('log')
        plt.tight_layout()
        plt.show()





def ExplorerFromResults(results: List[Dict[str, Any]], experiment_name: str|None = None) -> Explorer:
    raw_df = parse_results(results)

    if experiment_name:
        raw_df = raw_df.assign(experiment_name=pd.Series(experiment_name, index=raw_df.index, dtype='category'))

    clean_df = _clean_results(raw_df)
    exp = Explorer(clean_df)
    exp.raw_df = raw_df
    return exp


def parse_df_results(df_results: pd.DataFrame) -> pd.DataFrame:

    df_results = df_results.rename(columns={
        'task_index': 'task_index',
        'executor': 'executor',
        'args': 'args',
        'rep_index': 'rep_index',
        'data_token': 'data_token',
        'task_label': 'task_label',
        'gen.id': 'gen.id',
        'gen.descending': 'gen.descending',
        'gen.seed': 'gen.seed', 
        'metric': 'metric',

        ###
        'gen.cardinality': 'gen.cardinality',
        'gen.multiplicity': 'gen.multiplicity',
        'gen.swaps': 'gen.swaps', 
    })


    df_results['gen.swaps'] = df_results['gen.swaps'].astype('Int64')

    if 'gen.id' in df_results:
        df_results[['datagen_index', 'run_index', 'data_hash']] = df_results['gen.id'].str.split('_', expand=True)

    df_results['task_label'] = \
        df_results['executor'].astype(str) + ' ' + df_results['args'].str.join(" ")

    columns=[
        'rep_index', 
        'datagen_index', 
        'run_index', 
        'data_hash', 
        'executor', 
        'args', 
        'task_label', 
        'gen.cardinality', 
        'gen.multiplicity', 
        'gen.swaps', 
        'gen.descending', 
        'gen.seed', 
        'metric',
    ]

    if 'attr.experiment_name' in df_results:
        df_results['experiment_name'] = df_results['attr.experiment_name'].astype('category')
        del df_results['attr.experiment_name']
        columns.append('experiment_name')
    return df_results.reindex(columns=columns)

from impalab_py import LabFromResults
def ExplorerFromLabDf(results: List[Dict[str, Any]]) -> Explorer:
    lab = LabFromResults(results)
    df = lab.to_dataframe()
    raw_df = parse_df_results(df)
    exp = Explorer(_clean_results(raw_df))
    exp.raw_df = raw_df
    exp.lab = lab
    return exp














#######################################################################

    # def plot_distributions_interactive(self, varying_param_name: str, title: str = 'Performance Distributions', normalized=False):
    #     """
    #     Creates an interactive box plot with underlying scatter points to show performance distribution.
    #     """

    #     df = self.clean_df
    #     try:
    #         import plotly.express as px
    #     except ImportError:
    #         print("Plotly not installed. Please install it to view charts.")
    #         return

    #     if df.empty:
    #         print("Dataframe is empty. Skipping visualization.")
    #         return

    #     print(f"--- Interactive Distribution: {title} ---")

    #     metric_type = 'metric'
    #     metric_title =  'Duration'
    #     if normalized:
    #         metric_type = 'nomalized_metric'
    #         metric_title = 'Nomalized Duration'
    #         df['nomalized_metric'] = df['metric'] / df[varying_param_name]

    #     fig = px.box(
    #         df,
    #         x=varying_param_name,
    #         y=metric_type,
    #         color='task_label',
    #         title=title,
    #         points="all", # Show all points next to box
    #         hover_data=['language', 'gen.seed'],
    #         labels={
    #             varying_param_name: varying_param_name.title(),
    #             metric_type: f"{metric_title} (ns)",
    #             'task_label': "Algorithm"
    #         }
    #     )
        
    #     fig.update_traces(jitter=0.3)
    #     fig.update_layout(
    #         height=600, 
    #         xaxis_title=varying_param_name.title(), 
    #         yaxis_title=f"{metric_title} (ns)",
    #         legend_title="Algorithm"
    #     )
    #     fig.show()


    # def plot_trends(self, varying_param_name : str|None = None, title = "Median Sort Performance", normalized=False, xlog=False, ylog=False, show_table=False):
    #     """
    #     Generates a line plot showing the median duration vs. a varying parameter.

    #     Args:
    #         df (pd.DataFrame): The DataFrame containing the experiment results.
    #         varying_param_name (str): The name of the column representing the varying parameter.
    #         title (str): The title of the plot.
    #     """

    #     df = self.clean_df
    #     if df.empty:
    #         print(f"df is empty. Skipping trend analysis and visualization.")
    #         return

    #     metric_type = 'metric'
    #     metric_title =  'Duration'
    #     if normalized:
    #         metric_type = 'nomalized_metric'
    #         metric_title = 'Nomalized Duration'
    #         df['nomalized_metric'] = df['metric'] / df[varying_param_name]

    #     print(f"\n--- Trend Analysis: Median Duration vs. {str(varying_param_name).capitalize()} ---")
    #     # Group by the varied parameter and algorithm, calculate median duration
    #     df_summary = df.groupby(
    #         [varying_param_name or df.index, 'task_label']
    #     )[metric_type].median().reset_index() # TODO: somombo> consider returning this back to the user

    #     if show_table:
    #         # Display summary table
    #         print("Median Durations (ns):")
    #         display(df_summary)

    #     # Create the line plot
    #     plt.figure(figsize=(12, 10))
    #     sns.lineplot(
    #         data=df_summary,
    #         x=varying_param_name or df.index,
    #         y=metric_type,
    #         hue='task_label', # Color lines by algorithm
    #         # style='function_name', # Use different markers/lines
    #         marker='o',
    #         markers=True,
    #         markersize=8,
    #         linewidth=2
    #     )


    #     plt.title(title.title())
    #     plt.xlabel(str(varying_param_name or 'Index').capitalize())
    #     plt.ylabel(f'{metric_title} (ns)')
    #     # Consider log scales if the range is large or expecting polynomial behavior
    #     if xlog:
    #         plt.xscale('log')
    #     if ylog:
    #         plt.yscale('log')
    #     plt.grid(True, which="both", ls="--", alpha=0.7)
    #     plt.legend(title='Algorithm')
    #     plt.tight_layout()
    #     plt.show()